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
router.get('/events', queueController.events);


router.get('/videos', videoController.listVideos);
router.delete('/videos/:videoId', videoController.deleteVideo);
router.delete('/videos/cleanup', videoController.cleanupTemp);

export default router;