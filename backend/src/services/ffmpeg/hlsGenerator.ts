import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { QualityProfile, HLSResult } from './types';
import { QUALITY_PROFILES, HLS_CONFIG } from './config';
import { getVideoInfo } from './videoInfo';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { generateMasterPlaylist } from './playlistGenerator';

function buildFFmpegArgs(
    inputPath: string,
    quality: QualityProfile,
    encoder: string,
    gopSize: number,
    isWindows: boolean,
    segmentPath: string,
    outputFile: string
): string[] {
    const baseArgs = [
        '-i', inputPath,
        '-map', '0:v:0',
        '-c:v', encoder,
        '-preset', encoder === 'h264_nvenc' ? 'p4' : 'fast',
        '-b:v', quality.bitrate,
        '-maxrate', quality.maxrate,
        '-bufsize', quality.bufsize,
        '-vf', `scale=${quality.resolution}:flags=lanczos`,
        '-g', String(gopSize),
    ];

    if (isWindows) {
        baseArgs.push('-strict_gop', '1');
        baseArgs.push('-force_key_frames', 'expr:gte(t,n_forced*2)');
    }

    if (encoder === 'h264_nvenc') {
        baseArgs.push(
            '-rc', 'vbr',
            '-cq', '23',
            '-spatial_aq', '1',
            '-temporal_aq', '1',
            '-rc-lookahead', '32',
            '-no-scenecut', '1',
            '-b_ref_mode', '0'
        );
    }

    baseArgs.push(
        '-an',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '0',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPath,
        outputFile
    );

    return baseArgs;
}

function runFFmpegWithProgress(
    args: string[],
    isWindows: boolean,
    qualityName: string,
    onProgress: (percent: number) => void,
    qualityIndex: number,
    totalQualities: number,
    progressPerQuality: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, {
            windowsHide: true,
        });

        let duration = 0;
        let lastPercent = 0;

        proc.stderr.on('data', (data) => {
            const output = data.toString();

            if (output.includes('Duration:')) {
                const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (match) {
                    duration = parseInt(match[1]) * 3600 +
                               parseInt(match[2]) * 60 +
                               parseInt(match[3]) +
                               parseInt(match[4]) / 100;
                }
            }

            if (output.includes('time=')) {
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (timeMatch && duration > 0) {
                    const currentTime = parseInt(timeMatch[1]) * 3600 +
                                        parseInt(timeMatch[2]) * 60 +
                                        parseInt(timeMatch[3]) +
                                        parseInt(timeMatch[4]) / 100;
                    const percent = Math.round((currentTime / duration) * 100);
                    if (percent > lastPercent) {
                        lastPercent = percent;

                        const qualityContribution = (percent / 100) * progressPerQuality;
                        const totalProgress = (qualityIndex * progressPerQuality) + qualityContribution;
                        onProgress(Math.min(Math.round(totalProgress), 100));

                        if (percent % 10 === 0 || percent === 100) {
                            console.log(`     ${qualityName}: ${percent}% (${Math.round(totalProgress)}% total)`);
                        }
                    }
                }
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                const finalTotal = (qualityIndex + 1) * progressPerQuality;
                onProgress(Math.min(Math.round(finalTotal), 100));
                console.log(`     ✅ ${qualityName} completado`);
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code} for ${qualityName}`));
            }
        });

        proc.on('error', reject);
    });
}


async function extractAudioTracks(
    inputPath: string,
    outputPath: string,
    audioTracks: any[],
    audioBitrate: string
): Promise<void> {
    if (audioTracks.length === 0) return;

    console.log(`🎵 Generando ${audioTracks.length} playlists de audio separadas...`);
    for (let i = 0; i < audioTracks.length; i++) {
        const audioPlaylist = `audio_${i}.m3u8`;
        const audioOutput = path.join(outputPath, audioPlaylist);
        const segmentTemplate = path.join(outputPath, `audio_${i}_%03d.ts`);

        const args = [
            '-i', inputPath,
            '-map', `0:a:${i}`,
            '-c:a', 'aac',
            '-b:a', audioBitrate,
            '-f', 'hls',
            '-hls_time', '4',
            '-hls_list_size', '0',
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', segmentTemplate,
            audioOutput
        ];

        await new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args, { windowsHide: true });
            proc.on('close', (code) => {
                if (code === 0) resolve(null);
                else reject(new Error(`Audio ${i} failed with code ${code}`));
            });
            proc.on('error', reject);
        });

        console.log(`   ✅ Audio ${i + 1} (${audioTracks[i].language || 'track'}) generado`);
    }
}

async function extractSubtitles(
    inputPath: string,
    outputPath: string,
    subtitleTracks: any[]
): Promise<void> {
    if (subtitleTracks.length === 0) return;

    console.log('📝 Generando archivos de subtítulos WebVTT...');
    for (let i = 0; i < subtitleTracks.length; i++) {
        const lang = subtitleTracks[i].language || `sub${i}`;
        const vttFile = `subtitle_${i}.vtt`;
        const vttPath = path.join(outputPath, vttFile);

        const args = [
            '-i', inputPath,
            '-map', `0:s:${i}`,
            '-c:s', 'webvtt',
            vttPath
        ];

        await new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args, { windowsHide: true });
            proc.on('close', (code) => {
                if (code === 0) resolve(null);
                else reject(new Error(`Subtitle ${i} failed with code ${code}`));
            });
            proc.on('error', reject);
        });

        console.log(`   ✅ Subtítulo ${i + 1} (${lang}) generado`);
    }
}

export const generateHLS = async (
    inputPath: string,
    outputDir: string,
    videoId: string,
    onProgress: (percent: number) => void,
    qualities: QualityProfile[] = QUALITY_PROFILES
): Promise<HLSResult> => {
    const videoInfo = await getVideoInfo(inputPath);
    console.log(`📊 Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`);
    console.log(`🎵 Pistas de audio encontradas: ${videoInfo.audioTracks.length}`);
    videoInfo.audioTracks.forEach((track, i) => {
        console.log(`   Audio ${i + 1}: ${track.language} (${track.codec}, ${track.channels}ch)`);
    });
    console.log(`📝 Pistas de subtítulos encontradas: ${videoInfo.subtitleTracks.length}`);
    videoInfo.subtitleTracks.forEach((track, i) => {
        console.log(`   Subtitle ${i + 1}: ${track.language} (${track.codec})`);
    });

    const gpuInfo = await checkGPUAvailability();
    const encoder = gpuInfo.hasGPU ? 'h264_nvenc' : 'libx264';
    console.log(`🎬 Usando encoder: ${encoder}${gpuInfo.hasGPU ? ` (GPU: ${gpuInfo.gpuInfo})` : ' (CPU)'}`);

    const isWindows = process.platform === 'win32';
    console.log(`🖥️ SO: ${process.platform} (${isWindows ? 'Windows' : 'Linux/Docker'})`);

    return new Promise(async (resolve, reject) => {
        const outputPath = path.join(outputDir, videoId);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        let thumbnails: string[] = [];
        try {
            thumbnails = await generateThumbnails(inputPath, outputDir, videoId, 10);
            console.log(`📸 Thumbnails generados: ${thumbnails.length}`);
        } catch (err) {
            console.warn('⚠️ Error generando thumbnails:', err);
        }


        try {
            await extractAudioTracks(inputPath, outputPath, videoInfo.audioTracks, HLS_CONFIG.audioBitrate);
        } catch (err) {
            console.warn('⚠️ Error extrayendo audio:', err);
        }

        try {
            await extractSubtitles(inputPath, outputPath, videoInfo.subtitleTracks);
        } catch (err) {
            console.warn('⚠️ Error extrayendo subtítulos:', err);
        }

        console.log(`🔧 Procesando ${qualities.length} calidades...`);
        const totalProgress = 0;
        const progressPerQuality = 100 / qualities.length;
        const gopSize = videoInfo.gopSize || 48;

        for (let qIndex = 0; qIndex < qualities.length; qIndex++) {
            const quality = qualities[qIndex];
            const segmentName = `segment_${quality.name}_%03d.ts`;
            const playlistName = `playlist_${quality.name}.m3u8`;
            const outputFile = path.join(outputPath, playlistName);
            const segmentPath = path.join(outputPath, segmentName);

            const args = buildFFmpegArgs(
                inputPath,
                quality,
                encoder,
                gopSize,
                isWindows,
                segmentPath,
                outputFile
            );

            console.log(`  📹 [${qIndex + 1}/${qualities.length}] Procesando ${quality.name}...`);

            try {
                await runFFmpegWithProgress(
                    args,
                    isWindows,
                    quality.name,
                    onProgress,
                    qIndex,
                    qualities.length,
                    progressPerQuality
                );
            } catch (err) {
                console.error(`❌ Error en calidad ${quality.name}:`, err);
                reject(err);
                return;
            }
        }

        console.log(`✅ HLS generado usando ${encoder} (${qualities.length} calidades)`);

        generateMasterPlaylist(outputPath, qualities, videoInfo.audioTracks, videoInfo.subtitleTracks);

        let thumbnailTimeout = 0;
        while (thumbnails.length === 0 && thumbnailTimeout < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            thumbnailTimeout++;
        }

        onProgress(100);

        resolve({
            masterPlaylist: path.join(outputPath, 'index.m3u8'),
            thumbnails,
            audioTracks: videoInfo.audioTracks,
            subtitleTracks: videoInfo.subtitleTracks
        });
    });
};