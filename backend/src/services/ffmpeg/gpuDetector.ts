import { exec } from 'child_process';
import { promisify } from 'util';
import { GPUInfo } from './types';

const execAsync = promisify(exec);

export const checkGPUAvailability = async (): Promise<GPUInfo> => {
    try {
        // Verificar si nvidia-smi está disponible
        let gpuName = '';
        try {
            const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader');
            gpuName = stdout.trim();
        } catch (e) {
            console.log('💻 nvidia-smi no disponible');
        }

        if (!gpuName) {
            console.log('💻 No se detectó GPU NVIDIA');
            return { hasGPU: false, encoder: 'libx264' };
        }

        console.log(`🎮 NVIDIA GPU detected: ${gpuName}`);

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
                    console.log('⚠️ No se pudo verificar encoders');
                }
            }

            if (encoderCheck && encoderCheck.includes('h264_nvenc')) {
                console.log(`✅ NVENC disponible en FFmpeg`);
                return {
                    hasGPU: true,
                    encoder: 'h264_nvenc',
                    gpuInfo: gpuName
                };
            } else {
                console.log(`⚠️ FFmpeg no tiene soporte NVENC`);
                return { hasGPU: false, encoder: 'libx264' };
            }
        } catch (e) {
            console.log(`⚠️ Error verificando encoders: ${e}`);
            return { hasGPU: false, encoder: 'libx264' };
        }
    } catch (error) {
        console.log(`💻 Error en detección GPU: ${error}`);
        return { hasGPU: false, encoder: 'libx264' };
    }
};