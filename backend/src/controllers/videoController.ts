import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateHLS, checkGPUAvailability, getVideoInfo } from '../services/ffmpeg';
import { processingQueue } from '../services/queueService';
import { config } from '../config';
import { VideoMetadataService } from '../services/videoMetadata';
import { logger } from '../logger';

const metadataService = new VideoMetadataService(config.outputFolder);

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
    limits: { fileSize: 4 * 1024 * 1024 * 1024 }
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
                });
            }

            const videoPath = path.join(config.outputFolder, videoId);
            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({ error: 'Video not found' });
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

            const videoId = `video_${Date.now()}`;
            const inputPath = file.path;
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const info = await getVideoInfo(inputPath);
            const originalName = VideoMetadataService.getOriginalName(file.filename);
            const stats = fs.statSync(inputPath);
            
            metadataService.addOrUpdateVideo({
                id: videoId,
                originalName: originalName,
                createdAt: new Date().toISOString(),
                duration: info.duration,
                durationFormatted: info.durationFormatted, 
                size: stats.size,
                qualities: [],
                audioTracks: info.audioTracks,
                subtitleTracks: info.subtitleTracks,
            });

            res.json({
                success: true,
                jobId,
                videoId,
                originalName,
                message: 'Video processing started',
            });

            processingQueue.add({
                id: jobId,
                videoId,
                inputPath,
                outputDir: config.outputFolder,
            }).catch((error) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error({ jobId, error: errorMessage }, `Job ${jobId} failed`);
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Process error');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start processing' });
            }
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

        res.sendFile(segmentPath);
    },

    getThumbnail: (req: Request, res: Response) => {
        const { videoId, thumbnail } = req.params;
        const thumbPath = path.join(config.outputFolder, videoId, 'thumbnails', thumbnail);

        if (!fs.existsSync(thumbPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // si es vtt establecer el tipo correcto en el header
        if (thumbnail.endsWith('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.sendFile(thumbPath);
    },

    getQueueStatus: (req: Request, res: Response) => {
        res.json(processingQueue.getStatus());
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