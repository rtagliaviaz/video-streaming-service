import { Request, Response } from 'express';
import { progressEmitter } from '../services/eventEmitter';
import { getJobStatus } from '../services/queueService';
import { logger } from '../logger';

export const queueController = {
  events: async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const status = await getJobStatus(jobId);
      if (!status) {
        res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
        res.end();
        return;
      }

      const initialPayload = {
        jobId,
        progress: status.progress || 0,
        stage: status.data?.stage || 'idle',
        details: status.data?.progressDetails || {},
      };
      res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

      if (status.state === 'completed') {
        res.write(`data: ${JSON.stringify({ jobId, progress: 100, stage: 'done', details: {} })}\n\n`);
        setTimeout(() => res.end(), 300);
        return;
      }
      if (status.state === 'failed') {
        res.write(`data: ${JSON.stringify({ jobId, progress: -1, stage: 'failed', details: { error: status.failedReason } })}\n\n`);
        setTimeout(() => res.end(), 300);
        return;
      }
    } catch (error) {
      logger.error({ jobId, error }, 'Error fetching initial job status');
      res.write(`data: ${JSON.stringify({ error: 'Failed to get job status' })}\n\n`);
      res.end();
      return;
    }

    const listener = (payload: any) => {
      if (payload.jobId === jobId) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        if (payload.stage === 'done' || payload.stage === 'failed') {
          setTimeout(() => res.end(), 300);
        }
      }
    };

    progressEmitter.on('progress', listener);

    req.on('close', () => {
      progressEmitter.off('progress', listener);
    });
  },

  videosEvents: (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const listener = () => {
      res.write(`data: ${JSON.stringify({ type: 'changed' })}\n\n`);
    };

    progressEmitter.on('videos-changed', listener);

    // keep-alive cada 25s para evitar que proxies cierren la conexión
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 25000);

    req.on('close', () => {
      progressEmitter.off('videos-changed', listener);
      clearInterval(keepAlive);
    });
  },
};