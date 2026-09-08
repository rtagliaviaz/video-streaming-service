import { EventEmitter } from 'events';
import { generateHLS } from './ffmpeg';
import fs from 'fs';
import { logger } from '../logger';
import type { ProgressInfo } from './ffmpeg/types';

interface QueueItem {
    id: string;
    videoId: string;
    inputPath: string;
    outputDir: string;
    startTime?: number;
    resolve: (value: { 
        success: boolean; 
        outputPath?: string; 
        thumbnails?: string[];
        error?: string 
    }) => void;
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

class ProcessingQueue extends EventEmitter {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    private currentJobId: string | null = null;
    private currentProgressInfo: ProgressInfo | null = null;

    private getDetails(): ProgressInfo['details'] {
        return this.currentProgressInfo ? this.currentProgressInfo.details : {};
    }

    add(item: Omit<QueueItem, 'resolve'>): Promise<{ 
        success: boolean; 
        outputPath?: string; 
        thumbnails?: string[];
        error?: string 
    }> {
        return new Promise((resolve) => {
            const queueItem: QueueItem = {
                ...item,
                startTime: Date.now(),
                resolve,
            };
            this.queue.push(queueItem);
            this.emit('item-added', queueItem);
            this.processNext();
        });
    }

    private async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue.shift()!;
        this.currentJobId = item.id;
        this.currentProgressInfo = null;

        const startTime = Date.now();
        logger.info(`Job ${item.id} started at ${new Date(startTime).toLocaleTimeString()}`);

        this.emit('job-start', item);

        try {
            const outputPath = item.outputDir;

            const result = await generateHLS(
                item.inputPath,
                outputPath,
                item.videoId,
                (progressInfo: ProgressInfo) => {
                    this.currentProgressInfo = progressInfo;
                    this.emit('job-progress', item, progressInfo);
                }
            );

            const finalInfo: ProgressInfo = {
                percent: 100,
                stage: 'done',
                details: this.getDetails(),
            };
            this.emit('job-progress', item, finalInfo);

            const endTime = Date.now();
            const elapsedSeconds = (endTime - startTime) / 1000;
            const formattedTime = formatDuration(elapsedSeconds);

            logger.info(`Job ${item.id} completed in ${formattedTime}`);

            try {
                if (fs.existsSync(item.inputPath)) {
                    fs.unlinkSync(item.inputPath);
                    logger.info(`Original file deleted: ${item.inputPath}`);
                }
            } catch (deleteError) {
                const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
                logger.warn({ jobId: item.id, error: errorMessage }, 'Could not delete original file');
            }

            this.emit('job-complete', item, { startTime, endTime, elapsedSeconds: formattedTime });
            item.resolve({
                success: true,
                outputPath: `${outputPath}/${item.videoId}/index.m3u8`,
                thumbnails: result.thumbnails
            });

        } catch (error) {
            const endTime = Date.now();
            const elapsedSeconds = (endTime - startTime) / 1000;
            const formattedTime = formatDuration(elapsedSeconds);
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(
                { jobId: item.id, elapsed: formattedTime, error: errorMessage },
                `Job ${item.id} failed after ${formattedTime}`
            );
            this.emit('job-error', item, error);
            item.resolve({
                success: false,
                error: String(error)
            });
        } finally {
            this.isProcessing = false;
            this.currentJobId = null;
            this.currentProgressInfo = null;
            this.processNext();
        }
    }

    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            currentJobId: this.currentJobId,
            currentProgress: this.currentProgressInfo?.percent || 0,
            currentStage: this.currentProgressInfo?.stage || 'idle',
        };
    }
}

export const processingQueue = new ProcessingQueue();

processingQueue.on('item-added', (item) => {
    logger.info(`Job added to queue: ${item.id} (Video: ${item.videoId})`);
});

processingQueue.on('job-start', (item) => {
    logger.info(`Processing job: ${item.id}`);
});

processingQueue.on('job-progress', (item, progressInfo) => {
    if (progressInfo.percent % 10 === 0 || progressInfo.percent === 100) {
        logger.info(`Job ${item.id}: ${progressInfo.percent}% - Stage: ${progressInfo.stage}`);
    }
});

processingQueue.on('job-complete', (item, timing) => {
    logger.info(`Job ${item.id} completed in ${timing?.elapsedSeconds || '?'}`);
});

processingQueue.on('job-error', (item, error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: item.id, error: errorMessage }, `Job failed: ${item.id}`);
});