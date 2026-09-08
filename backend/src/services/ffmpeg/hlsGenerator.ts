import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import pLimit from 'p-limit';
import { QualityProfile, HLSResult, ProgressInfo } from './types';
import { QUALITY_PROFILES, HLS_CONFIG } from './config';
import { getVideoInfo } from './videoInfo';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { generateMasterPlaylist } from './playlistGenerator';
import { logger } from '../../logger';

const CONCURRENCY_LIMIT = 3;

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
    onQualityProgress: (percent: number) => void
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
                        onQualityProgress(percent);
                        if (percent % 10 === 0 || percent === 100) {
                            logger.info(`[${qualityName}] ${percent}%`);
                        }
                    }
                }
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                onQualityProgress(100);
                logger.info(`${qualityName} completed`);
                resolve();
            } else {
                logger.error({ quality: qualityName, code }, `FFmpeg exited with code ${code} for ${qualityName}`);
                reject(new Error(`FFmpeg exited with code ${code} for ${qualityName}`));
            }
        });

        proc.on('error', (err) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error({ quality: qualityName, error: errorMessage }, `FFmpeg error for ${qualityName}`);
            reject(err);
        });
    });
}

async function extractAudioTracks(
    inputPath: string,
    outputPath: string,
    audioTracks: any[],
    audioBitrate: string
): Promise<void> {
    if (audioTracks.length === 0) return;

    logger.info(`Generating ${audioTracks.length} audio playlists...`);
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
                if (code === 0) {
                    logger.info(`Audio ${i + 1} (${audioTracks[i].language || 'track'}) generated`);
                    resolve(null);
                } else {
                    logger.error({ audioIndex: i, code }, `Audio ${i} failed with code ${code}`);
                    reject(new Error(`Audio ${i} failed with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error({ audioIndex: i, error: errorMessage }, `Audio ${i} error`);
                reject(err);
            });
        });
    }
}

async function extractSubtitles(
    inputPath: string,
    outputPath: string,
    subtitleTracks: any[]
): Promise<void> {
    if (subtitleTracks.length === 0) return;

    logger.info({ trackCount: subtitleTracks.length }, 'Generating WebVTT subtitle files...');
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
                if (code === 0) {
                    logger.info(`Subtitle ${i + 1} (${lang}) generated`);
                    resolve(null);
                } else {
                    logger.error({ subtitleIndex: i, code }, `Subtitle ${i} failed with code ${code}`);
                    reject(new Error(`Subtitle ${i} failed with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error({ subtitleIndex: i, error: errorMessage }, `Subtitle ${i} error`);
                reject(err);
            });
        });
    }
}

export const generateHLS = async (
    inputPath: string,
    outputDir: string,
    videoId: string,
    onProgress: (info: ProgressInfo) => void,
    qualities: QualityProfile[] = QUALITY_PROFILES
): Promise<HLSResult> => {
    const videoInfo = await getVideoInfo(inputPath);
    logger.info(
        {
            videoId,
            audioTracks: videoInfo.audioTracks.length,
            subtitleTracks: videoInfo.subtitleTracks.length,
        },
        `Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`
    );

    videoInfo.audioTracks.forEach((track, i) => {
        logger.debug(
            { audioIndex: i, language: track.language, codec: track.codec, channels: track.channels },
            `Audio ${i + 1}: ${track.language} (${track.codec}, ${track.channels}ch)`
        );
    });
    videoInfo.subtitleTracks.forEach((track, i) => {
        logger.debug(
            { subtitleIndex: i, language: track.language, codec: track.codec },
            `Subtitle ${i + 1}: ${track.language} (${track.codec})`
        );
    });

    const gpuInfo = await checkGPUAvailability();
    const encoder = gpuInfo.hasGPU ? 'h264_nvenc' : 'libx264';
    logger.info(`Using encoder: ${encoder}${gpuInfo.hasGPU ? ` (GPU: ${gpuInfo.gpuInfo})` : ' (CPU)'}`);

    const isWindows = process.platform === 'win32';
    logger.info(`OS: ${process.platform} (${isWindows ? 'Windows' : 'Linux/Docker'})`);

    return new Promise(async (resolve, reject) => {
        const outputPath = path.join(outputDir, videoId);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
            logger.info(`Output directory created: ${outputPath}`);
        }

        const emitProgress = (stage: ProgressInfo['stage'], percent: number, details?: ProgressInfo['details']) => {
            onProgress({
                percent: Math.min(100, Math.round(percent)),
                stage,
                details: details || {},
            });
        };

        let thumbResult = { thumbnails: [] as string[], sprite: '', vtt: '' };
        try {
            emitProgress('thumbnails', 2);
            thumbResult = await generateThumbnails(inputPath, outputDir, videoId, 40);
            emitProgress('thumbnails', 10, {
                thumbnailsGenerated: thumbResult.thumbnails.length,
                totalThumbnails: 40,
                spriteGenerated: !!thumbResult.sprite,
            });
            logger.info(`Thumbnails generated: ${thumbResult.thumbnails.length} individual, sprite: ${thumbResult.sprite}, vtt: ${thumbResult.vtt}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn({ error: errorMessage }, 'Error generating thumbnails');
        }

        try {
            emitProgress('audio', 12);
            await extractAudioTracks(inputPath, outputPath, videoInfo.audioTracks, HLS_CONFIG.audioBitrate);
            emitProgress('audio', 15, {
                audioTracksExtracted: videoInfo.audioTracks.length,
                totalAudioTracks: videoInfo.audioTracks.length,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn({ error: errorMessage }, 'Error extracting audio');
        }

        try {
            emitProgress('subtitles', 17);
            await extractSubtitles(inputPath, outputPath, videoInfo.subtitleTracks);
            emitProgress('subtitles', 20, {
                subtitlesExtracted: videoInfo.subtitleTracks.length,
                totalSubtitles: videoInfo.subtitleTracks.length,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn({ error: errorMessage }, 'Error extracting subtitles');
        }

        logger.info(`Processing ${qualities.length} qualities in parallel (limit: ${CONCURRENCY_LIMIT})...`);
        const gopSize = videoInfo.gopSize || 48;

        const qualityProgress = new Array(qualities.length).fill(0);
        const qualitiesStatus: { name: string; status: 'pending' | 'processing' | 'completed' | 'failed' }[] = 
            qualities.map(q => ({
                name: q.name,
                status: 'pending' as const,
            }));

        const updateTotalProgress = () => {
            const total = qualityProgress.reduce((sum, p) => sum + p, 0) / qualities.length;
            const percent = 20 + (total / 100) * 80;
            const rounded = Math.min(Math.round(percent), 100);
            const completed = qualitiesStatus.filter(q => q.status === 'completed').length;
            const current = qualitiesStatus.find(q => q.status === 'processing');
            emitProgress('qualities', rounded, {
                completedQualities: completed,
                totalQualities: qualities.length,
                currentQuality: current?.name,
                qualitiesStatus: [...qualitiesStatus],
            });
        };

        const processQuality = async (qIndex: number): Promise<void> => {
            const quality = qualities[qIndex];
            qualitiesStatus[qIndex].status = 'processing';
            updateTotalProgress();

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

            logger.info(`[${qIndex + 1}/${qualities.length}] Processing ${quality.name}...`);

            const onQualityProgress = (percent: number) => {
                qualityProgress[qIndex] = percent;
                updateTotalProgress();
            };

            try {
                await runFFmpegWithProgress(args, isWindows, quality.name, onQualityProgress);
                qualitiesStatus[qIndex].status = 'completed';
                qualityProgress[qIndex] = 100;
                updateTotalProgress();
            } catch (err) {
                qualitiesStatus[qIndex].status = 'failed';
                throw err;
            }
        };

        const limit = pLimit(CONCURRENCY_LIMIT);
        const tasks = qualities.map((_, index) => limit(() => processQuality(index)));

        try {
            await Promise.all(tasks);
            emitProgress('done', 100, {
                completedQualities: qualities.length,
                totalQualities: qualities.length,
                qualitiesStatus: qualitiesStatus,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error({ error: errorMessage }, 'Error processing one or more qualities');
            reject(err);
            return;
        }

        logger.info(`HLS generated using ${encoder} (${qualities.length} qualities)`);

        generateMasterPlaylist(outputPath, qualities, videoInfo.audioTracks, videoInfo.subtitleTracks);

        let thumbnailTimeout = 0;
        while (thumbResult.thumbnails.length === 0 && thumbnailTimeout < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            thumbnailTimeout++;
        }

        const result: HLSResult = {
            masterPlaylist: path.join(outputPath, 'index.m3u8'),
            thumbnails: thumbResult.thumbnails,
            audioTracks: videoInfo.audioTracks,
            subtitleTracks: videoInfo.subtitleTracks,
            thumbnailsSprite: thumbResult.sprite || undefined,
            thumbnailsVtt: thumbResult.vtt || undefined,
        };

        resolve(result);
    });
};