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

export const config = {
    videoFolder: getVideoFolder(),
    outputFolder: getOutputFolder(),
    port: parseInt(process.env.PORT || '3001', 10),
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