import express from 'express';
import { videoController } from '../controllers/videoController';
import { queueController } from '../controllers/queueController';

const router = express.Router();

router.get('/gpu/info', videoController.getGPUInfo);

router.get('/video/info/:videoId', videoController.getVideoInfo);

router.post('/upload', videoController.uploadVideo, videoController.processVideo);

router.get('/stream/:videoId', videoController.getStream);
router.get('/segment/:videoId/:segment', videoController.getSegment);

router.get('/thumbnails/:videoId/:thumbnail', videoController.getThumbnail);

router.get('/queue/status', videoController.getQueueStatus);

router.get('/videos/events', queueController.videosEvents);

router.get('/videos', videoController.listVideos);
router.delete('/videos/:videoId', videoController.deleteVideo);
router.delete('/videos/cleanup', videoController.cleanupTemp);

router.get('/jobs', videoController.listJobsHandler);
router.get('/jobs/:jobId', videoController.getJobStatusHandler);
router.delete('/jobs/:jobId', videoController.cancelJobHandler);
router.post('/jobs/:jobId/retry', videoController.retryJobHandler);

router.get('/events/:jobId', queueController.events);

export default router;