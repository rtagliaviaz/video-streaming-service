import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const getVideoFolder = (): string => {
    const envPath = process.env.VIDEO_FOLDER_PATH;
    if (envPath) {
        return path.resolve(envPath);
    }
    return path.join(__dirname, '../uploads');
};

const getOutputFolder = (): string => {
    const envPath = process.env.OUTPUT_FOLDER_PATH;
    if (envPath) {
        return path.resolve(envPath);
    }
    return path.join(__dirname, '../hls');
};

const getRedisConfig = () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
});


const getMinioConfig = () => ({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'hls',
});

const getDrmConfig = () => ({
    enabled: process.env.DRM_ENABLED !== 'false',
    licenseServiceUrl: process.env.LICENSE_SERVICE_URL || 'http://localhost:4000',
    packagerPath: process.env.SHAKA_PACKAGER_PATH || './bin/packager.exe',
    mp4dashScript: process.env.BENTO4_MP4DASH_SCRIPT || './utils/mp4-dash.py',
    mp4fragmentPath: process.env.BENTO4_MP4FRAGMENT_PATH || './bin/mp4fragment.exe',
    pythonBin: process.env.BENTO4_PYTHON_BIN || 'python',
});

export const config = {
    videoFolder: getVideoFolder(),
    outputFolder: getOutputFolder(),
    port: parseInt(process.env.PORT || '3001', 10),
    redis: getRedisConfig(),
    minio: getMinioConfig(),
    drm: getDrmConfig(),
};

export const ensureDirectories = () => {
    const dirs = [config.videoFolder, config.outputFolder];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info(`Created directory: ${dir}`);
        }
    }

};