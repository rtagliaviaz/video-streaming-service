import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { checkGPUAvailability, getVideoInfo } from '../services/ffmpeg';
import {
    videoQueue,
    addVideoJob,
    getJobStatus,
    listJobs,
    cancelVideoJob,
    retryVideoJob,
} from '../services/queueService';
import { config } from '../config';
import { metadataService, VideoMetadataService } from '../services/videoMetadata';
import { logger } from '../logger';
import { progressEmitter } from '../services/eventEmitter';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.videoFolder);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}-${originalName}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 * 1024 },
});

export const videoController = {
    uploadVideo: upload.single('video'),

    getVideoInfo: async (req: Request, res: Response) => {
        try {
            const { videoId } = req.params;
            const metadata = metadataService.getVideo(videoId);

            if (metadata) {
                return res.json({
                    videoId,
                    audioTracks: metadata.audioTracks || [],
                    subtitleTracks: metadata.subtitleTracks || [],
                    duration: metadata.duration || 0,
                    originalName: metadata.originalName,
                    size: metadata.size,
                    qualities: metadata.qualities || [],
                    status: metadata.status || 'unknown',
                    jobId: metadata.jobId,
                });
            }

            const uploadsDir = config.videoFolder;
            const files = fs.readdirSync(uploadsDir);
            const originalFile = files.find(f => f.includes(videoId.replace('video_', '')));

            if (!originalFile) {
                return res.json({ audioTracks: [], subtitleTracks: [] });
            }

            const inputPath = path.join(uploadsDir, originalFile);
            const info = await getVideoInfo(inputPath);

            res.json({
                videoId,
                audioTracks: info.audioTracks || [],
                subtitleTracks: info.subtitleTracks || [],
                duration: info.duration || 0,
                originalName: VideoMetadataService.getOriginalName(originalFile),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage, videoId: req.params.videoId }, 'Get video info error');
            res.status(500).json({ error: 'Failed to get video info' });
        }
    },

    getGPUInfo: async (req: Request, res: Response) => {
        try {
            const gpuInfo = await checkGPUAvailability();
            res.json({
                ...gpuInfo,
                message: gpuInfo.hasGPU ? 'NVIDIA GPU detected and available' : 'Using CPU (no GPU)'
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'GPU info error');
            res.json({ hasGPU: false, encoder: 'libx264', error: String(error) });
        }
    },

    processVideo: async (req: Request, res: Response) => {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            let selectedQualities: string[] | null = null;
            if (req.body.qualities) {
                try {
                    selectedQualities = typeof req.body.qualities === 'string'
                        ? JSON.parse(req.body.qualities)
                        : req.body.qualities;
                } catch (e) {
                    logger.warn('Invalid qualities format, using all qualities');
                }
            }

            const videoId = `video_${Date.now()}`;
            const inputPath = file.path;

            const info = await getVideoInfo(inputPath);
            const originalName = VideoMetadataService.getOriginalName(file.filename);
            const stats = fs.statSync(inputPath);

            const initialMetadata = {
                id: videoId,
                originalName,
                createdAt: new Date().toISOString(),
                duration: info.duration,
                durationFormatted: info.durationFormatted || '00:00:00',
                size: stats.size,
                qualities: selectedQualities || [],
                audioTracks: info.audioTracks,
                subtitleTracks: info.subtitleTracks,
                status: 'queued' as const,
            };
            metadataService.addOrUpdateVideo(initialMetadata);

            const jobId = await addVideoJob(
                inputPath,
                config.outputFolder,
                selectedQualities || ['480p', '720p', '1080p', '1440p'],
                videoId
            );

            const updatedMetadata = {
                ...initialMetadata,
                jobId,
            };
            metadataService.addOrUpdateVideo(updatedMetadata);

            progressEmitter.emit('videos-changed');

            res.json({
                success: true,
                jobId,
                videoId,
                originalName,
                message: 'Video enqueued for processing',
                qualities: selectedQualities,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Process error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start processing' });
            }
        }
    },

    getJobStatusHandler: async (req: Request, res: Response) => {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({ error: 'jobId required' });
        }
        try {
            const status = await getJobStatus(jobId);
            if (!status) {
                return res.status(404).json({ error: 'Job not found' });
            }
            res.json(status);
        } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed to get job status' });
        }
    },

    listJobsHandler: async (req: Request, res: Response) => {
        const { states, limit, offset } = req.query;
        try {
            const statesArray = states
                ? (states as string).split(',') as ('waiting' | 'active' | 'completed' | 'failed' | 'delayed')[]
                : undefined;
            const jobs = await listJobs(statesArray, Number(limit) || 20, Number(offset) || 0);
            res.json(jobs);
        } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed to list jobs' });
        }
    },

    cancelJobHandler: async (req: Request, res: Response) => {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({ error: 'jobId required' });
        }
        try {
            const cancelled = await cancelVideoJob(jobId);
            if (!cancelled) {
                return res.status(404).json({ error: 'Job not found or not cancellable' });
            }
            res.json({ success: true, message: 'Job cancelled' });
        } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed to cancel job' });
        }
    },

    retryJobHandler: async (req: Request, res: Response) => {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({ error: 'jobId required' });
        }
        try {
            const retried = await retryVideoJob(jobId);
            if (!retried) {
                return res.status(404).json({ error: 'Job not found or not retryable' });
            }
            res.json({ success: true, message: 'Job retried' });
        } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed to retry job' });
        }
    },

    getStream: (req: Request, res: Response) => {
        const { videoId } = req.params;
        const playlistPath = path.join(config.outputFolder, videoId, 'index.m3u8');

        if (!fs.existsSync(playlistPath)) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.sendFile(playlistPath);
    },

    getSegment: (req: Request, res: Response) => {
        const { videoId, segment } = req.params;
        const segmentPath = path.join(config.outputFolder, videoId, segment);

        if (!fs.existsSync(segmentPath)) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        if (segment.endsWith('.m4s')) {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (segment.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (segment.endsWith('.ts')) {
            res.setHeader('Content-Type', 'video/mp2t');
        } else if (segment.endsWith('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        }

        res.sendFile(segmentPath);
    },

    getThumbnail: (req: Request, res: Response) => {
        const { videoId, thumbnail } = req.params;
        const thumbPath = path.join(config.outputFolder, videoId, 'thumbnails', thumbnail);

        if (!fs.existsSync(thumbPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (thumbnail.endsWith('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.sendFile(thumbPath);
    },

    getQueueStatus: async (req: Request, res: Response) => {
        try {
            const counts = await videoQueue.getJobCounts();
            res.json({
                waiting: counts.waiting || 0,
                active: counts.active || 0,
                completed: counts.completed || 0,
                failed: counts.failed || 0,
                delayed: counts.delayed || 0,
            });
        } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed to get queue status' });
        }
    },

    listVideos: (req: Request, res: Response) => {
        try {
            const videos = metadataService.getAllVideos();

            const enrichedVideos = videos.map(video => {
                const videoPath = path.join(config.outputFolder, video.id);
                const exists = fs.existsSync(videoPath);
                const qualities = getAvailableQualities(videoPath);
                const thumbnails = getAvailableThumbnails(videoPath);

                return {
                    id: video.id,
                    originalName: video.originalName,
                    createdAt: video.createdAt,
                    duration: video.duration,
                    durationFormatted: video.durationFormatted || '00:00:00',
                    size: video.size,
                    exists,
                    playlist: exists ? `/api/stream/${video.id}` : null,
                    qualities: qualities.length > 0 ? qualities : video.qualities,
                    thumbnails: thumbnails.length > 0 ? thumbnails : null,
                    status: video.status || 'unknown',
                    jobId: video.jobId || null,
                };
            });

            res.json({ videos: enrichedVideos });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'List videos error');
            res.status(500).json({ error: 'Failed to list videos' });
        }
    },

    deleteVideo: async (req: Request, res: Response) => {
        try {
            const { videoId } = req.params;
            const videoPath = path.join(config.outputFolder, videoId);

            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({ error: 'Video not found' });
            }

            fs.rmSync(videoPath, { recursive: true, force: true });
            logger.info(`Deleted video: ${videoId}`);

            metadataService.deleteVideo(videoId);

            progressEmitter.emit('videos-changed');

            const uploadsDir = config.videoFolder;
            const uploadFiles = fs.readdirSync(uploadsDir).filter(f => f.includes(videoId.replace('video_', '')));
            uploadFiles.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    logger.info(`Deleted upload: ${file}`);
                }
            });

            res.json({ success: true, message: 'Video deleted successfully' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage, videoId: req.params.videoId }, 'Delete video error');
            res.status(500).json({ error: 'Failed to delete video' });
        }
    },

    cleanupTemp: (req: Request, res: Response) => {
        try {
            const uploadsDir = config.videoFolder;
            const files = fs.readdirSync(uploadsDir);
            let deletedCount = 0;

            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

                if (ageInHours > 24 && !isFileBeingProcessed(file)) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    logger.info(`Cleaned up temp file: ${file}`);
                }
            });

            res.json({
                success: true,
                message: `Cleaned up ${deletedCount} temporary files`
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Cleanup error');
            res.status(500).json({ error: 'Failed to cleanup temporary files' });
        }
    },
};

function getAvailableQualities(videoPath: string): string[] {
    try {
        const files = fs.readdirSync(videoPath);
        const qualityPatterns = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p'];
        return qualityPatterns.filter(pattern =>
            files.some(f => f.includes(pattern))
        );
    } catch {
        return [];
    }
}

function getAvailableThumbnails(videoPath: string): string[] {
    try {
        const thumbPath = path.join(videoPath, 'thumbnails');
        if (!fs.existsSync(thumbPath)) return [];
        const files = fs.readdirSync(thumbPath)
            .filter(f => f.endsWith('.jpg'))
            .sort();
        return files.map(f => `/api/thumbnails/${path.basename(videoPath)}/${f}`);
    } catch {
        return [];
    }
}

function isFileBeingProcessed(filename: string): boolean {
    return false;
}