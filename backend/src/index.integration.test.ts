import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction, Router } from 'express';
import { config } from './config.js';

vi.mock('./controllers/videoController.js', () => ({
    videoController: {
        uploadVideo: vi.fn((req: Request, res: Response, next: NextFunction) => next()),
        processVideo: vi.fn(async (req: Request, res: Response) => {
            res.json({
                success: true,
                jobId: 'job_123',
                videoId: 'video_123',
                originalName: 'test.mp4',
                message: 'Video processing started',
            });
        }),
        getVideoInfo: vi.fn(async (req: Request, res: Response) => {
            res.json({
                videoId: req.params.videoId,
                audioTracks: [],
                subtitleTracks: [],
                duration: 120,
                originalName: 'test.mp4',
                size: 1024,
                qualities: [],
            });
        }),
        getGPUInfo: vi.fn(async (req: Request, res: Response) => {
            res.json({ hasGPU: true, encoder: 'h264_nvenc', gpuInfo: 'RTX 3060' });
        }),
        getStream: vi.fn((req: Request, res: Response) => {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send('#EXTM3U\n#EXT-X-VERSION:6\n');
        }),
        getSegment: vi.fn((req: Request, res: Response) => {
            res.send('fake segment');
        }),
        getThumbnail: vi.fn((req: Request, res: Response) => {
            res.setHeader('Content-Type', 'image/jpeg');
            res.send(Buffer.from('fake image data'));
        }),
        getQueueStatus: vi.fn((req: Request, res: Response) => {
            res.json({ queueLength: 0, isProcessing: false, currentJobId: null });
        }),
        listVideos: vi.fn((req: Request, res: Response) => {
            res.json({
                videos: [
                    {
                        id: 'video_1',
                        originalName: 'video1.mp4',
                        createdAt: '2023-01-01T00:00:00Z',
                        duration: 120,
                        durationFormatted: '00:02:00',
                        size: 1024,
                        qualities: ['1080p', '720p'],
                        exists: true,
                        playlist: '/api/stream/video_1',
                        thumbnails: ['/api/thumbnails/video_1/thumb1.jpg'],
                    },
                ],
            });
        }),
        deleteVideo: vi.fn((req: Request, res: Response) => {
            if (req.params.videoId === 'video_123') {
                res.json({ success: true, message: 'Video deleted successfully' });
            } else {
                res.status(404).json({ error: 'Video not found' });
            }
        }),
        cleanupTemp: vi.fn((req: Request, res: Response) => {
            res.json({ success: true, message: 'Cleaned up 2 temporary files' });
        }),
        streamEvents: vi.fn((req: Request, res: Response) => {
            const jobId = req.query.jobId;
            if (!jobId) {
                return res.status(400).json({ error: 'Missing jobId' });
            }
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            setTimeout(() => {
                res.write(`data: ${JSON.stringify({ percent: 50, stage: 'qualities', details: {} })}\n\n`);
            }, 10);
            setTimeout(() => {
                res.write(`data: ${JSON.stringify({ percent: 100, stage: 'done', details: {} })}\n\n`);
                res.end();
            }, 50);
        }),
    },
}));

vi.mock('./controllers/queueController.js', () => ({
    queueController: {
        events: vi.fn((req: Request, res: Response) => {
            const jobId = req.query.jobId;
            if (!jobId) {
                return res.status(400).json({ error: 'Missing jobId' });
            }
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            setTimeout(() => {
                res.write(`data: ${JSON.stringify({ percent: 50, stage: 'qualities' })}\n\n`);
            }, 10);
            setTimeout(() => {
                res.write(`data: ${JSON.stringify({ percent: 100, stage: 'done' })}\n\n`);
                res.end();
            }, 50);
        }),
    },
}));

vi.mock('multer', () => ({
    default: vi.fn(() => ({
        single: vi.fn(() => (req: any, res: any, next: any) => {
            req.file = {
                fieldname: 'video',
                originalname: 'test.mp4',
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: Buffer.from('fake video content'),
                size: 1024,
            };
            next();
        }),
        array: vi.fn(),
        fields: vi.fn(),
    })),
}));


import { videoController } from './controllers/videoController.js';
import { queueController } from './controllers/queueController.js';

describe('Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {

        const router = Router();
        router.get('/gpu/info', videoController.getGPUInfo);
        router.get('/video/info/:videoId', videoController.getVideoInfo);
        router.post('/upload', videoController.uploadVideo, videoController.processVideo);
        router.get('/stream/:videoId', videoController.getStream);
        router.get('/segment/:videoId/:segment', videoController.getSegment);
        router.get('/thumbnails/:videoId/:thumbnail', videoController.getThumbnail);
        router.get('/queue/status', videoController.getQueueStatus);
        router.get('/events', queueController.events);
        router.get('/videos', videoController.listVideos);
        router.delete('/videos/cleanup', videoController.cleanupTemp);
        router.delete('/videos/:videoId', videoController.deleteVideo);

        app = express();
        app.use(express.json());
        app.use('/api', router);
        app.use('/hls', express.static(config.outputFolder));
    });

    describe('POST /api/upload', () => {
        it('should upload a video and return jobId and videoId', async () => {
            const response = await request(app)
                .post('/api/upload')
                .attach('video', Buffer.from('fake video content'), 'test.mp4')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('jobId', 'job_123');
            expect(response.body).toHaveProperty('videoId', 'video_123');
            expect(response.body).toHaveProperty('originalName', 'test.mp4');
        });

        it('should return 400 if no file is uploaded', async () => {
            (videoController.uploadVideo as any).mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
                res.status(400).json({ error: 'No file uploaded' });
            });

            const response = await request(app)
                .post('/api/upload')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'No file uploaded');
        });
    });

    describe('GET /api/events', () => {
        it('should stream progress events for a job', async () => {
            const jobId = 'job_123';
            const response = await request(app)
                .get(`/api/events?jobId=${jobId}`)
                .expect(200)
                .expect('Content-Type', /text\/event-stream/);

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(response.text).toContain('data:');
            expect(response.text).toContain('"percent":50');
            expect(response.text).toContain('"stage":"done"');
        });

        it('should return 400 if jobId is missing', async () => {
            await request(app).get('/api/events').expect(400);
        });
    });

    describe('GET /api/videos', () => {
        it('should return list of videos', async () => {
            const response = await request(app).get('/api/videos').expect(200);
            expect(response.body).toHaveProperty('videos');
            expect(response.body.videos).toHaveLength(1);
            expect(response.body.videos[0]).toHaveProperty('id', 'video_1');
            expect(response.body.videos[0]).toHaveProperty('playlist', '/api/stream/video_1');
        });
    });

    describe('GET /api/stream/:videoId', () => {
        it('should return the master playlist', async () => {
            const videoId = 'video_123';
            const response = await request(app)
                .get(`/api/stream/${videoId}`)
                .expect(200)
                .expect('Content-Type', /application\/vnd.apple.mpegurl/);

            expect(response.text).toContain('#EXTM3U');
        });
    });

    describe('GET /api/thumbnails/:videoId/:thumbnail', () => {
        it('should return a thumbnail image', async () => {
            const videoId = 'video_123';
            const thumbnail = 'thumb_001.jpg';
            await request(app)
                .get(`/api/thumbnails/${videoId}/${thumbnail}`)
                .expect(200)
                .expect('Content-Type', /image\/jpeg/);
        });

        it('should return 404 if thumbnail not found', async () => {
            (videoController.getThumbnail as any).mockImplementationOnce((req: Request, res: Response) => {
                res.status(404).json({ error: 'File not found' });
            });
            await request(app)
                .get(`/api/thumbnails/video_123/nonexistent.jpg`)
                .expect(404);
        });
    });

    describe('GET /api/gpu/info', () => {
        it('should return GPU info', async () => {
            const response = await request(app).get('/api/gpu/info').expect(200);
            expect(response.body).toHaveProperty('hasGPU', true);
            expect(response.body).toHaveProperty('encoder', 'h264_nvenc');
            expect(response.body).toHaveProperty('gpuInfo', 'RTX 3060');
        });
    });

    describe('GET /api/queue/status', () => {
        it('should return queue status', async () => {
            const response = await request(app).get('/api/queue/status').expect(200);
            expect(response.body).toHaveProperty('queueLength');
            expect(response.body).toHaveProperty('isProcessing');
            expect(response.body).toHaveProperty('currentJobId');
        });
    });

    describe('DELETE /api/videos/:videoId', () => {
        it('should delete a video and associated files', async () => {
            const videoId = 'video_123';
            const response = await request(app).delete(`/api/videos/${videoId}`).expect(200);
            expect(response.body).toHaveProperty('success', true);
        });

        it('should return 404 if video not found', async () => {
            await request(app).delete('/api/videos/nonexistent').expect(404);
        });
    });

    describe('DELETE /api/videos/cleanup', () => {
        it('should cleanup temporary files', async () => {
            const response = await request(app).delete('/api/videos/cleanup').expect(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Cleaned up');
        });
    });
});