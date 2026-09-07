import { exec } from 'child_process';
import { promisify } from 'util';
import { GPUInfo } from './types';
import { logger } from '../../logger';

const execAsync = promisify(exec);

export const checkGPUAvailability = async (): Promise<GPUInfo> => {
    try {
        let gpuName = '';
        try {
            const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader');
            gpuName = stdout.trim();
        } catch (e) {
            logger.info('nvidia-smi not available');
        }

        if (!gpuName) {
            logger.info('No NVIDIA GPU detected');
            return { hasGPU: false, encoder: 'libx264' };
        }

        logger.info(`NVIDIA GPU detected: ${gpuName}`);

        try {
            let encoderCheck = '';
            try {
                const { stdout } = await execAsync('ffmpeg -encoders | findstr nvenc');
                encoderCheck = stdout;
            } catch (e) {
                try {
                    const { stdout } = await execAsync('ffmpeg -encoders | grep -i nvenc');
                    encoderCheck = stdout;
                } catch (grepError) {
                    logger.warn('Could not verify encoders');
                }
            }

            if (encoderCheck && encoderCheck.includes('h264_nvenc')) {
                logger.info('NVENC available in FFmpeg');
                return {
                    hasGPU: true,
                    encoder: 'h264_nvenc',
                    gpuInfo: gpuName
                };
            } else {
                logger.warn('FFmpeg does not support NVENC');
                return { hasGPU: false, encoder: 'libx264' };
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.warn({ error: errorMessage }, 'Error verifying encoders');
            return { hasGPU: false, encoder: 'libx264' };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'GPU detection error');
        return { hasGPU: false, encoder: 'libx264' };
    }
};