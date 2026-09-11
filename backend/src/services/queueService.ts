import { Queue, Worker, Job, UnrecoverableError, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { generateHLS } from './ffmpeg/hlsGenerator';
import { logger } from '../logger';
import { metadataService } from './videoMetadata';
import { ProgressInfo } from './ffmpeg/types';
import { progressEmitter } from './eventEmitter';

const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});


const backendStartTime = Date.now();
logger.info('[bullmq] Initializing Redis connection...');

connection.on('connect', () => {
  logger.info(
    `[bullmq] Redis TCP connected`
  );
});

connection.on('ready', () => {
  logger.info(
    `[bullmq] Redis ready to accept commands`
  );
});

connection.on('error', (err) => {
  logger.error({ err: err.message }, '[bullmq] Redis connection error');
});

export const videoQueue = new Queue('video-processing', { connection });

const jobAbortControllers = new Map<string, AbortController>();

export const videoWorker = new Worker(
  'video-processing',
  async (job: Job) => {
    if (!job) throw new Error('Job is undefined');
    const { videoPath, outputDir, qualities, videoId } = job.data;

    const queuedAt = job.timestamp;
    const waitMs = Date.now() - queuedAt;
    logger.info(
      `[bullmq] Picking up job ${job.id} for video ${videoId} ` +
      `(waited ${(waitMs / 1000).toFixed(1)}s in queue)`
    );

    const outputPath = path.join(outputDir, videoId);
    if (fs.existsSync(outputPath)) {
      try {
        fs.rmSync(outputPath, { recursive: true, force: true });
        logger.info(`[bullmq] Cleaned previous output: ${outputPath}`);
      } catch (err) {
        logger.warn({ err, outputPath }, '[bullmq] Failed to clean previous output');
      }
    }

    const controller = new AbortController();
    jobAbortControllers.set(job.id!, controller);

    const updateProgress = async (info: ProgressInfo) => {
      if (info.stage === 'done') return;

      await job.updateProgress(info.percent);
      await job.updateData({
        ...job.data,
        progressDetails: info.details,
        stage: info.stage,
      });

      progressEmitter.emit('progress', {
        jobId: job.id,
        progress: info.percent,
        stage: info.stage,
        details: info.details,
      });
    };

    try {
      const existingStart = metadataService.getVideo(videoId);
      if (existingStart) {
        metadataService.addOrUpdateVideo({
          ...existingStart,
          status: 'processing',
        });
      }
      progressEmitter.emit('videos-changed');

      const result = await generateHLS(
        videoPath,
        outputDir,
        videoId,
        updateProgress,
        qualities,
        controller.signal
      );

      jobAbortControllers.delete(job.id!);

      try {
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
          logger.info(`[bullmq] Deleted temp upload: ${videoPath}`);
        }
      } catch (err) {
        logger.warn({ err, videoPath }, '[bullmq] Failed to delete temp upload');
      }

      const existing = metadataService.getVideo(videoId);
      if (existing) {
        metadataService.addOrUpdateVideo({
          ...existing,
          status: 'completed',
          error: undefined,
        });
      }
      progressEmitter.emit('videos-changed');

      await job.updateProgress(100);
      await job.updateData({
        ...job.data,
        progressDetails: { completed: true },
        stage: 'done',
      });

      progressEmitter.emit('progress', {
        jobId: job.id,
        progress: 100,
        stage: 'done',
        details: { completed: true },
      });

      logger.info(
        `[bullmq] Job ${job.id} finished in ${((Date.now() - queuedAt) / 1000).toFixed(1)}s total`
      );
      return result;
    } catch (err) {
      const wasCancelled = controller.signal.aborted;
      jobAbortControllers.delete(job.id!);

      if (wasCancelled) {
        logger.info(`[bullmq] Job ${job.id} cancelled by user`);
        throw new UnrecoverableError('Cancelled by user');
      }
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

videoWorker.on('ready', () => {
  logger.info(
    `[bullmq] Worker is READY to process jobs`
  );
});

videoWorker.on('active', (job) => {
  logger.info(`[bullmq] Job ${job.id} is now ACTIVE`);
});

videoWorker.on('stalled', (jobId: string, prev: string) => {
  logger.warn(`[bullmq] Job ${jobId} STALLED (was ${prev}, will be re-queued)`);
});

videoWorker.on('drained', () => {
  logger.info('[bullmq] Queue drained - no more jobs waiting');
});

videoWorker.on('completed', (job) => {
  if (job) logger.info(`[bullmq] Job ${job.id} completed`);
});

videoWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`[bullmq] Job ${job.id} failed: ${err.message}`);
    const videoId = job.data.videoId;
    const existing = metadataService.getVideo(videoId);
    if (existing) {
      metadataService.addOrUpdateVideo({
        ...existing,
        status: 'failed',
        error: err.message,
      });
    }
    progressEmitter.emit('videos-changed');

    progressEmitter.emit('progress', {
      jobId: job.id,
      progress: -1,
      stage: 'failed',
      details: { error: err.message },
    });
  } else {
    logger.error(`[bullmq] A job without ID failed: ${err.message}`);
  }
});

videoWorker.on('error', (err) => {
  logger.error(`[bullmq] Worker error: ${err.message}`);
});

export const queueEvents = new QueueEvents('video-processing', { connection });

queueEvents.on('waiting', ({ jobId }) => {
  logger.info(`[bullmq] Job ${jobId} is WAITING`);
});

(async () => {
  try {
    const counts = await videoQueue.getJobCounts();
    logger.info(
      `[bullmq] Queue counts on startup - waiting: ${counts.waiting || 0}, ` +
      `active: ${counts.active || 0}, delayed: ${counts.delayed || 0}, ` +
      `completed: ${counts.completed || 0}, failed: ${counts.failed || 0}`
    );

    const waiting = await videoQueue.getJobs(['waiting', 'delayed'], 0, 100);
    const active = await videoQueue.getJobs(['active'], 0, 100);
    const pending = [...waiting, ...active];

    if (pending.length > 0) {
      logger.info(
        `[bullmq] Found ${pending.length} pending job(s) to resume: ` +
        pending.map((j) => `#${j.id} (video ${j.data.videoId})`).join(', ')
      );
    } else {
      logger.info('[bullmq] No pending jobs to resume');
    }
  } catch (err) {
    logger.warn({ err }, '[bullmq] Failed to log pending jobs on startup');
  }
})();


export async function getJobStatus(jobId: string) {
  const job = await videoQueue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const progress = job.progress;
  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
  };
}

export async function listJobs(
  states?: ('waiting' | 'active' | 'completed' | 'failed' | 'delayed')[],
  limit = 20,
  offset = 0
) {
  const jobs = await videoQueue.getJobs(states, offset, offset + limit);
  return Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      data: job.data,
      timestamp: job.timestamp,
    }))
  );
}

export async function addVideoJob(
  videoPath: string,
  outputDir: string,
  qualities: string[],
  videoId: string
) {
  const job = await videoQueue.add(
    'process-video',
    {
      videoPath,
      outputDir,
      qualities,
      videoId,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600, count: 200 },
      removeOnFail: { age: 24 * 3600, count: 200 },
    }
  );
  return job.id;
}

export async function cancelVideoJob(jobId: string): Promise<boolean> {
  const job = await videoQueue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state !== 'waiting' && state !== 'delayed' && state !== 'active') {
    return false;
  }

  const videoId = job.data.videoId;

  if (state === 'waiting' || state === 'delayed') {
    await job.remove();

    const existing = metadataService.getVideo(videoId);
    if (existing) {
      metadataService.addOrUpdateVideo({
        ...existing,
        status: 'failed',
        error: 'Cancelled by user',
      });
    }

    progressEmitter.emit('videos-changed');
    progressEmitter.emit('progress', {
      jobId,
      progress: -1,
      stage: 'failed',
      details: { error: 'Cancelled by user' },
    });

    logger.info(`[bullmq] Job ${jobId} removed from queue (was ${state})`);
    return true;
  }

  const controller = jobAbortControllers.get(jobId);
  if (controller) {
    controller.abort();
    logger.info(`[bullmq] Job ${jobId} cancellation requested (aborting)`);
    return true;
  }

  return false;
}

export async function retryVideoJob(jobId: string): Promise<boolean> {
  const job = await videoQueue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state !== 'failed') return false;

  await job.retry();

  const videoId = job.data.videoId;
  const existing = metadataService.getVideo(videoId);
  if (existing) {
    metadataService.addOrUpdateVideo({
      ...existing,
      status: 'queued',
      error: undefined,
    });
  }

  progressEmitter.emit('videos-changed');
  logger.info(`[bullmq] Job ${jobId} retried`);
  return true;
}

export { connection };