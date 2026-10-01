import { Request, Response } from 'express';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../logger';
import { connection, videoQueue } from '../services/queueService';
import { getAllVideos } from '../services/videoRepository';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../services/s3Service';

const START_TIME = Date.now();

interface ComponentHealth {
    status: 'up' | 'down';
    latencyMs?: number;
    error?: string;
    details?: Record<string, any>;
}

interface HealthReport {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptimeSeconds: number;
    timestamp: string;
    components: {
        redis: ComponentHealth;
        minio: ComponentHealth;
        database: ComponentHealth;
        licenseService: ComponentHealth;
        filesystem: ComponentHealth;
        queue: ComponentHealth;
    };
}

async function checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
        const result = await connection.ping();
        const latencyMs = Date.now() - start;
        if (result !== 'PONG') {
            return { status: 'down', latencyMs, error: `Unexpected PING: ${result}` };
        }
        return { status: 'up', latencyMs };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}

async function checkMinio(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
        const s3 = getS3Client();
        await s3.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
        const latencyMs = Date.now() - start;
        return { status: 'up', latencyMs };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}
function checkDatabase(): ComponentHealth {
    const start = Date.now();
    try {
        const videos = getAllVideos();
        const latencyMs = Date.now() - start;
        return { status: 'up', latencyMs, details: { videoCount: videos.length } };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}

async function checkLicenseService(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${config.drm.licenseServiceUrl}/api/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        if (!response.ok) {
            return { status: 'down', latencyMs, error: `HTTP ${response.status}` };
        }
        return { status: 'up', latencyMs };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}

function checkFilesystem(): ComponentHealth {
    const start = Date.now();
    try {
        const dirs = [
            { name: 'videoFolder', path: config.videoFolder },
            { name: 'outputFolder', path: config.outputFolder },
        ];
        const results: Record<string, any> = {};
        for (const dir of dirs) {
            const exists = fs.existsSync(dir.path);
            let writable = false;
            if (exists) {
                try {
                    fs.accessSync(dir.path, fs.constants.W_OK);
                    writable = true;
                } catch { writable = false; }
            }
            results[dir.name] = { path: dir.path, exists, writable };
        }
        const allOk = Object.values(results).every((r: any) => r.exists && r.writable);
        const latencyMs = Date.now() - start;
        if (!allOk) {
            return { status: 'down', latencyMs, error: 'Missing or not writable', details: results };
        }
        return { status: 'up', latencyMs, details: results };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}

async function checkQueue(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
        const counts = await videoQueue.getJobCounts();
        const latencyMs = Date.now() - start;
        return {
            status: 'up',
            latencyMs,
            details: {
                waiting: counts.waiting || 0,
                active: counts.active || 0,
                delayed: counts.delayed || 0,
                completed: counts.completed || 0,
                failed: counts.failed || 0,
            },
        };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'down', latencyMs, error: message };
    }
}

export const healthController = {
    getHealth: async (req: Request, res: Response) => {
        const [redis, minio, licenseService, queue] = await Promise.all([
            checkRedis(),
            checkMinio(),
            checkLicenseService(),
            checkQueue(),
        ]);
        const database = checkDatabase();
        const filesystem = checkFilesystem();

        const components = { redis, minio, database, licenseService, filesystem, queue };

        const criticalDown = redis.status === 'down' || minio.status === 'down';
        const someDown = Object.values(components).some(c => c.status === 'down');

        let status: HealthReport['status'];
        if (criticalDown) status = 'unhealthy';
        else if (someDown) status = 'degraded';
        else status = 'healthy';

        const report: HealthReport = {
            status,
            uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
            timestamp: new Date().toISOString(),
            components,
        };

        if (status !== 'healthy') {
            logger.warn({ status, components }, '[health] Non-healthy report');
        }

        res.status(status === 'unhealthy' ? 503 : 200).json(report);
    },

    getLiveness: (req: Request, res: Response) => {
        res.status(200).json({
            status: 'ok',
            uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
            timestamp: new Date().toISOString(),
        });
    },

    getReadiness: async (req: Request, res: Response) => {
        const redis = await checkRedis();
        if (redis.status === 'down') {
            return res.status(503).json({
                status: 'not-ready',
                reason: 'Redis unavailable',
                timestamp: new Date().toISOString(),
            });
        }
        res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    },
};