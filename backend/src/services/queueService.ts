import { EventEmitter } from 'events';
import { generateHLS } from './ffmpegService';

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

class ProcessingQueue extends EventEmitter {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    private currentJobId: string | null = null;
    private currentProgress: number = 0;

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
        this.currentProgress = 0;
        
        const startTime = Date.now();
        console.log(`⏱️ Job ${item.id} iniciado a las ${new Date(startTime).toLocaleTimeString()}`);

        this.emit('job-start', item);

        try {
            const outputPath = item.outputDir;

            const result = await generateHLS(
                item.inputPath,
                outputPath,
                item.videoId,
                (percent) => {
                    this.currentProgress = percent;
                    this.emit('job-progress', item, percent);
                }
            );

            this.currentProgress = 100;
            
            const endTime = Date.now();
            const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);
            const elapsedMinutes = Math.floor(Number(elapsedSeconds) / 60);
            const remainingSeconds = Math.floor(Number(elapsedSeconds) % 60);
            const timeStr = elapsedMinutes > 0 
                ? `${elapsedMinutes}m ${remainingSeconds}s` 
                : `${elapsedSeconds}s`;

            console.log(`✅ Job ${item.id} completado en ${timeStr}`);
            console.log(`⏱️ Inicio: ${new Date(startTime).toLocaleTimeString()}`);
            console.log(`⏱️ Fin: ${new Date(endTime).toLocaleTimeString()}`);
            console.log(`📊 Velocidad: ${((item.inputPath ? 'procesado' : ''))}`); 
            this.emit('job-complete', item, { startTime, endTime, elapsedSeconds });
            item.resolve({ 
                success: true, 
                outputPath: `${outputPath}/${item.videoId}/index.m3u8`,
                thumbnails: result.thumbnails
            });

        } catch (error) {
            const endTime = Date.now();
            const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);
            console.error(` Job ${item.id} falló después de ${elapsedSeconds}s:`, error);
            this.emit('job-error', item, error);
            item.resolve({ 
                success: false, 
                error: String(error) 
            });
        } finally {
            this.isProcessing = false;
            this.currentJobId = null;
            this.currentProgress = 0;
            this.processNext();
        }
    }

    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            currentJobId: this.currentJobId,
            currentProgress: this.currentProgress,
        };
    }
}

export const processingQueue = new ProcessingQueue();

processingQueue.on('item-added', (item) => {
    console.log(`Job añadido a la cola: ${item.id} (Video: ${item.videoId})`);
});

processingQueue.on('job-start', (item) => {
    console.log(`Procesando job: ${item.id}`);
});

processingQueue.on('job-progress', (item, percent) => {
    if (percent % 10 === 0 || percent === 100) {
        console.log(`Job ${item.id}: ${percent}%`);
    }
});

processingQueue.on('job-complete', (item, timing) => {
    const elapsed = timing ? (timing.elapsedSeconds / 60).toFixed(1) : '?';
    console.log(`🎉 Job ${item.id} completado en ${elapsed} minutos`);
});

processingQueue.on('job-error', (item, error) => {
    console.error(`Job falló: ${item.id}`, error);
});