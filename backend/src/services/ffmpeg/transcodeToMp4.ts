import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import pLimit from 'p-limit';
import { QualityProfile, ProgressInfo } from './types';
import { QUALITY_PROFILES } from './config';
import { getVideoInfo } from './videoInfo';
import { VideoInfo } from './types';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { logger } from '../../logger';

const CONCURRENCY_LIMIT = 3;

export interface VideoMp4Output {
    quality: string;
    path: string;
    bitrate: number;
    width: number;
    height: number;
}

export interface AudioMp4Output {
    index: number;
    path: string;
    language: string;
    channels: number;
}

export interface SubtitleOutput {
    index: number;
    path: string;
    language: string;
}

export interface TranscodeResult {
    videoMp4s: VideoMp4Output[];
    audioMp4s: AudioMp4Output[];
    subtitles: SubtitleOutput[];
    thumbnails: {
        thumbnails: string[];
        sprite: string;
        vtt: string;
    };
    videoInfo: VideoInfo;
}

function buildVideoMp4Args(
    inputPath: string,
    outputPath: string,
    quality: QualityProfile,
    encoder: string,
    gopSize: number,
    isWindows: boolean
): string[] {
    const args = [
        '-i', inputPath,
        '-map', '0:v:0',
        '-c:v', encoder,
        '-b:v', quality.bitrate,
        '-maxrate', quality.maxrate,
        '-bufsize', quality.bufsize,
        '-vf', `scale=${quality.resolution}:flags=lanczos`,
        '-g', String(gopSize),
        '-an',
        '-movflags', '+faststart',
    ];

    if (encoder === 'hevc_nvenc') {
        args.push('-preset', 'p5', '-profile:v', 'main');
    } else if (encoder === 'h264_nvenc') {
        args.push('-preset', 'p4');
    } else {
        args.push('-preset', 'fast');
    }

    if (isWindows) {
        args.push('-strict_gop', '1');
        args.push('-force_key_frames', 'expr:gte(t,n_forced*2)');
    }

    if (encoder.includes('nvenc')) {
        args.push(
            '-rc', 'vbr',
            '-cq', '23',
            '-spatial_aq', '1',
            '-temporal_aq', '1',
            '-rc-lookahead', '32',
            '-no-scenecut', '1',
            '-b_ref_mode', '0'
        );
    }

    args.push(outputPath);
    return args;
}

function runFFmpeg(
    args: string[],
    label: string,
    onProgress: (percent: number) => void,
    duration: number,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('CANCELLED'));

        const proc = spawn('ffmpeg', args, { windowsHide: true, signal });
        let lastPercent = 0;
        let lastLoggedPercent = 0;

        proc.stderr.on('data', (data) => {
            const output = data.toString();
            if (output.includes('time=') && duration > 0) {
                const m = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (m) {
                    const current = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
                    const percent = Math.round((current / duration) * 100);
                    if (percent > lastPercent) {
                        lastPercent = percent;
                        onProgress(percent);

                        // Log cada 10% para no saturar
                        if (percent >= lastLoggedPercent + 10 || percent === 100) {
                            lastLoggedPercent = Math.floor(percent / 10) * 10;
                            logger.info(`[${label}] ${percent}%`);
                        }
                    }
                }
            }
        });

        proc.on('close', (code, sig) => {
            if (signal?.aborted || sig === 'SIGTERM') return reject(new Error('CANCELLED'));
            if (code === 0) {
                logger.info(`[${label}] completed`);
                resolve();
            } else {
                logger.error({ code }, `[${label}] FFmpeg exited with code ${code}`);
                reject(new Error(`FFmpeg (${label}) exited with code ${code}`));
            }
        });

        proc.on('error', (err: any) => {
            if (err?.name === 'AbortError' || signal?.aborted) return reject(new Error('CANCELLED'));
            logger.error({ err: err.message, label }, `[${label}] FFmpeg error`);
            reject(err);
        });
    });
}

export async function transcodeToMp4(
    inputPath: string,
    outputDir: string,
    videoId: string,
    selectedQualityNames: string[] | null,
    onProgress: (info: ProgressInfo) => void,
    signal?: AbortSignal
): Promise<TranscodeResult> {
    const qualities = selectedQualityNames && selectedQualityNames.length > 0
        ? QUALITY_PROFILES.filter(q => selectedQualityNames.includes(q.name))
        : QUALITY_PROFILES;

    const videoInfo = await getVideoInfo(inputPath);
    const gpuInfo = await checkGPUAvailability();
    const isWindows = process.platform === 'win32';
    const h264Encoder = gpuInfo.hasGPU && isWindows ? 'h264_nvenc' : 'libx264';
    const gopSize = videoInfo.gopSize || 48;

    const workDir = path.join(outputDir, videoId);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    // log de inicio con toda la info del video
    logger.info(
        {
            videoId,
            duration: `${videoInfo.duration.toFixed(2)}s (${videoInfo.durationFormatted})`,
            resolution: `${videoInfo.width}x${videoInfo.height}`,
            fps: videoInfo.fps.toFixed(2),
            gopSize,
            encoder: h264Encoder,
            isWindows,
            audioTracks: videoInfo.audioTracks.length,
            subtitleTracks: videoInfo.subtitleTracks.length,
            qualities: qualities.map(q => q.name).join(', '),
        },
        '[transcode] Starting transcoding'
    );

    const emit = (stage: ProgressInfo['stage'], percent: number, details?: ProgressInfo['details']) => {
        onProgress({ percent: Math.min(100, Math.round(percent)), stage, details: details || {} });
    };

    emit('thumbnails', 2);
    let thumbResult = { thumbnails: [] as string[], sprite: '', vtt: '' };
    try {
        logger.info('[transcode] Generating 40 thumbnails + sprite...');
        thumbResult = await generateThumbnails(inputPath, outputDir, videoId, 40);
        emit('thumbnails', 10, {
            thumbnailsGenerated: thumbResult.thumbnails.length,
            totalThumbnails: 40,
            spriteGenerated: !!thumbResult.sprite,
        });
        logger.info(`[transcode] Thumbnails generated: ${thumbResult.thumbnails.length} individual, sprite: ${thumbResult.sprite ? 'yes' : 'no'}`);
    } catch (err) {
        logger.warn({ err }, '[transcode] Thumbnail generation failed (continuing)');
    }

    emit('subtitles', 12);
    const subtitles: SubtitleOutput[] = [];
    if (videoInfo.subtitleTracks.length > 0) {
        logger.info(`[transcode] Extracting ${videoInfo.subtitleTracks.length} subtitle track(s)...`);
    }
    for (let i = 0; i < videoInfo.subtitleTracks.length; i++) {
        const track = videoInfo.subtitleTracks[i];
        const vttPath = path.join(workDir, `subtitle_${i}.vtt`);
        const args = ['-i', inputPath, '-map', `0:s:${i}`, '-c:s', 'webvtt', vttPath];
        try {
            logger.info(`[transcode] Subtitle ${i + 1}/${videoInfo.subtitleTracks.length} (${track.language || 'unknown'})...`);
            await runFFmpeg(args, `subtitle ${i}`, () => {}, 0, signal);
            subtitles.push({
                index: i,
                path: vttPath,
                language: track.language || `sub${i}`,
            });
            logger.info(`[transcode] Subtitle ${i} (${track.language}) extracted`);
        } catch (err) {
            logger.warn({ err, index: i }, `[transcode] Subtitle extraction failed for index ${i}`);
        }
    }
    emit('subtitles', 15, { subtitlesExtracted: subtitles.length });

    emit('audio', 17);
    const audioMp4s: AudioMp4Output[] = [];
    if (videoInfo.audioTracks.length > 0) {
        logger.info(`[transcode] Extracting ${videoInfo.audioTracks.length} audio track(s)...`);
    }
    for (let i = 0; i < videoInfo.audioTracks.length; i++) {
        const track = videoInfo.audioTracks[i];
        const audioPath = path.join(workDir, `audio_${i}.mp4`);
        const args = [
            '-i', inputPath,
            '-map', `0:a:${i}`,
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            audioPath,
        ];
        logger.info(`[transcode] Audio ${i + 1}/${videoInfo.audioTracks.length} (${track.language || 'unknown'}, ${track.channels || 2}ch)...`);
        await runFFmpeg(args, `audio ${i}`, () => {}, 0, signal);
        audioMp4s.push({
            index: i,
            path: audioPath,
            language: track.language || `track${i}`,
            channels: track.channels || 2,
        });
        logger.info(`[transcode] Audio ${i} (${track.language}) extracted`);
    }
    emit('audio', 20, { audioTracksExtracted: audioMp4s.length });

    const videoMp4s: VideoMp4Output[] = [];
    const qualityProgress = new Array(qualities.length).fill(0);

    const updateVideoProgress = () => {
        const total = qualityProgress.reduce((a, b) => a + b, 0) / qualities.length;
        emit('qualities', 20 + (total / 100) * 60, {
            totalQualities: qualities.length,
            completedQualities: qualityProgress.filter(p => p >= 100).length,
        });
    };

    logger.info(`[transcode] Processing ${qualities.length} video qualities in parallel (limit: ${CONCURRENCY_LIMIT})...`);

    const limit = pLimit(CONCURRENCY_LIMIT);
    const tasks = qualities.map((quality, idx) =>
        limit(async () => {
            const outPath = path.join(workDir, `video_${quality.name}.mp4`);
            const args = buildVideoMp4Args(inputPath, outPath, quality, h264Encoder, gopSize, isWindows);

            logger.info(`[transcode] [${h264Encoder}] [${idx + 1}/${qualities.length}] Processing ${quality.name}...`);

            await runFFmpeg(
                args,
                `video ${quality.name}`,
                (p) => { qualityProgress[idx] = p; updateVideoProgress(); },
                videoInfo.duration,
                signal
            );

            qualityProgress[idx] = 100;
            updateVideoProgress();

            videoMp4s.push({
                quality: quality.name,
                path: outPath,
                bitrate: parseInt(quality.bitrate) * 1000,
                width: quality.width,
                height: quality.height,
            });

            logger.info(`[transcode] [${quality.name}] Encoding complete`);
        })
    );

    await Promise.all(tasks);
    emit('qualities', 80);

    videoMp4s.sort((a, b) => a.height - b.height);

    emit('done', 85, {
        completedQualities: qualities.length,
        totalQualities: qualities.length,
    });

    logger.info(
        {
            videoId,
            videoMp4s: videoMp4s.length,
            audioMp4s: audioMp4s.length,
            subtitles: subtitles.length,
            thumbnails: thumbResult.thumbnails.length,
        },
        '[transcode] Transcoding complete'
    );

    return {
        videoMp4s,
        audioMp4s,
        subtitles,
        thumbnails: thumbResult,
        videoInfo,
    };
}