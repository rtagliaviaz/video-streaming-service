import { Request, Response } from 'express';
import { processingQueue } from '../services/queueService';

export const queueController = {
    events: (req: Request, res: Response) => {
        const { jobId } = req.query;
        if (!jobId) {
            return res.status(400).json({ error: 'Missing jobId' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const listener = (item: any, progressInfo: any) => {
            if (item.id === jobId) {
                res.write(`data: ${JSON.stringify(progressInfo)}\n\n`);
            }
        };

        processingQueue.on('job-progress', listener);

        req.on('close', () => {
            processingQueue.off('job-progress', listener);
            res.end();
        });
    }
};