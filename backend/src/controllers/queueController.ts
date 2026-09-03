import { Request, Response } from 'express';
import { processingQueue } from '../services/queueService';

export const queueController = {
    // GET /api/events
    events: (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const jobId = req.query.jobId as string;

        if (!jobId) {
            res.write(`data: ${JSON.stringify({ error: 'jobId is required' })}\n\n`);
            res.end();
            return;
        }

        const status = processingQueue.getStatus();
        if (status.currentJobId === jobId) {
            res.write(`data: ${JSON.stringify({ progress: status.currentProgress, jobId })}\n\n`);
        }

        const onProgress = (item: any, percent: number) => {
            if (item.id === jobId) {
                res.write(`data: ${JSON.stringify({ progress: percent, jobId })}\n\n`);
            }
        };

        const onComplete = (item: any) => {
            if (item.id === jobId) {
                res.write(`data: ${JSON.stringify({ progress: 100, jobId, done: true })}\n\n`);
                res.end();
            }
        };

        const onError = (item: any, error: Error) => {
            if (item.id === jobId) {
                res.write(`data: ${JSON.stringify({ progress: 0, jobId, error: error.message })}\n\n`);
                res.end();
            }
        };

        processingQueue.on('job-progress', onProgress);
        processingQueue.on('job-complete', onComplete);
        processingQueue.on('job-error', onError);

        req.on('close', () => {
            processingQueue.off('job-progress', onProgress);
            processingQueue.off('job-complete', onComplete);
            processingQueue.off('job-error', onError);
            res.end();
        });
    },
};