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
            return { hasGPU: false, encoder: 'libx264', supportsHevc: false };
        }

        logger.info(`NVIDIA GPU detected: ${gpuName}`);

        let h264NvencAvailable = false;
        try {
            const { stdout } = await execAsync('ffmpeg -encoders | findstr nvenc');
            if (stdout.includes('h264_nvenc')) h264NvencAvailable = true;
        } catch (e) {
            try {
                const { stdout } = await execAsync('ffmpeg -encoders | grep -i nvenc');
                if (stdout.includes('h264_nvenc')) h264NvencAvailable = true;
            } catch (grepError) {
                logger.warn('Could not verify H.264 NVENC support');
            }
        }

        let hevcNvencAvailable = false;
        if (process.platform === 'win32') {
            try {
                const { stdout } = await execAsync('ffmpeg -encoders | findstr hevc_nvenc');
                if (stdout.includes('hevc_nvenc')) hevcNvencAvailable = true;
            } catch (e) {
                try {
                    const { stdout } = await execAsync('ffmpeg -encoders | grep -i hevc_nvenc');
                    if (stdout.includes('hevc_nvenc')) hevcNvencAvailable = true;
                } catch (grepError) {
                    logger.warn('Could not verify HEVC NVENC support');
                }
            }
        } else {
            logger.info('HEVC NVENC only supported on Windows, skipping detection');
        }

        let encoder = 'libx264';
        const isWindows = process.platform === 'win32';

        if (isWindows && h264NvencAvailable) {
            if (hevcNvencAvailable) {
                encoder = 'hevc_nvenc';
                logger.info(`HEVC NVENC available, using ${encoder}`);
            } else {
                encoder = 'h264_nvenc';
                logger.info(`HEVC NVENC not available, using ${encoder}`);
            }
        } else if (h264NvencAvailable && isWindows) {
            encoder = 'h264_nvenc';
            logger.info(`Using ${encoder}`);
        } else {
            logger.info('Using CPU encoder: libx264');
        }

        if (process.platform !== 'win32') {
            encoder = 'libx264';
            logger.info('Linux: forcing CPU encoder libx264');
        }

        return {
            hasGPU: h264NvencAvailable && isWindows,
            encoder,
            gpuInfo: gpuName,
            supportsHevc: hevcNvencAvailable && isWindows,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'GPU detection error');
        return { hasGPU: false, encoder: 'libx264', supportsHevc: false };
    }
};