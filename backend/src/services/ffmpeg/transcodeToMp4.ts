import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import pLimit from 'p-limit';
import { QualityProfile, ProgressInfo } from './types';
import { QUALITY_PROFILES, HLS_CONFIG } from './config';
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
    codec: 'h264' | 'hevc';
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
    videoMp4sHevc: VideoMp4Output[];
    audioMp4s: AudioMp4Output[];
    subtitles: SubtitleOutput[];
    thumbnails: {
        thumbnails: string[];
        sprite: string;
        vtt: string;
    };
    videoInfo: VideoInfo;
    hevcEnabled: boolean;
}

function buildVideoMp4Args(
    inputPath: string,
    outputPath: string,
    quality: QualityProfile,
    encoder: string,
    gopSize: number,
    isWindows: boolean
): string[] {
    const isHevc = encoder === 'hevc_nvenc';
    const effectiveBitrate = isHevc
        ? `${Math.round(parseInt(quality.bitrate) * 0.7)}k`
        : quality.bitrate;
    const effectiveMaxrate = isHevc
        ? `${Math.round(parseInt(quality.maxrate) * 0.7)}k`
        : quality.maxrate;
    const effectiveBufsize = isHevc
        ? `${Math.round(parseInt(quality.bufsize) * 0.7)}k`
        : quality.bufsize;

    const args = [
        '-i', inputPath,
        '-map', '0:v:0',
        '-c:v', encoder,
        '-b:v', effectiveBitrate,
        '-maxrate', effectiveMaxrate,
        '-bufsize', effectiveBufsize,
        '-vf', `scale=${quality.resolution}:flags=lanczos`,
        '-g', String(gopSize),
        '-an',
        '-movflags', '+faststart',
    ];

    // tag the HEVC stream as hvc1 (Apple-compatible, parameter sets out-of-band)
    if (isHevc) {
        args.push('-tag:v', 'hvc1');
    }

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
    const hevcEncoder = 'hevc_nvenc';
    const gopSize = videoInfo.gopSize || 48;

    // HEVC requires: config flag + HEVC support + Windows
    const hevcEnabled: boolean =
        HLS_CONFIG.enableHevc === true &&
        gpuInfo.supportsHevc === true &&
        isWindows === true;

    const workDir = path.join(outputDir, videoId);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    logger.info(
        {
            videoId,
            duration: `${videoInfo.duration.toFixed(2)}s (${videoInfo.durationFormatted})`,
            resolution: `${videoInfo.width}x${videoInfo.height}`,
            fps: videoInfo.fps.toFixed(2),
            gopSize,
            h264Encoder,
            hevcEncoder: hevcEnabled ? hevcEncoder : 'disabled',
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
        emit('thumbnails', 8, {
            thumbnailsGenerated: thumbResult.thumbnails.length,
            totalThumbnails: 40,
            spriteGenerated: !!thumbResult.sprite,
        });
        logger.info(`[transcode] Thumbnails generated: ${thumbResult.thumbnails.length}`);
    } catch (err) {
        logger.warn({ err }, '[transcode] Thumbnail generation failed (continuing)');
    }

    emit('subtitles', 10);
    const subtitles: SubtitleOutput[] = [];
    if (videoInfo.subtitleTracks.length > 0) {
        logger.info(`[transcode] Extracting ${videoInfo.subtitleTracks.length} subtitle track(s)...`);
    }
    for (let i = 0; i < videoInfo.subtitleTracks.length; i++) {
        const track = videoInfo.subtitleTracks[i];
        const vttPath = path.join(workDir, `subtitle_${i}.vtt`);
        const args = ['-i', inputPath, '-map', `0:s:${i}`, '-c:s', 'webvtt', vttPath];
        try {
            await runFFmpeg(args, `subtitle ${i}`, () => {}, 0, signal);
            subtitles.push({ index: i, path: vttPath, language: track.language || `sub${i}` });
        } catch (err) {
            logger.warn({ err, index: i }, `[transcode] Subtitle extraction failed for ${i}`);
        }
    }
    emit('subtitles', 12, { subtitlesExtracted: subtitles.length });

    emit('audio', 14);
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
        logger.info(`[transcode] Audio ${i + 1}/${videoInfo.audioTracks.length} (${track.language || 'unknown'})...`);
        await runFFmpeg(args, `audio ${i}`, () => {}, 0, signal);
        audioMp4s.push({
            index: i,
            path: audioPath,
            language: track.language || `track${i}`,
            channels: track.channels || 2,
        });
    }
    emit('audio', 16, { audioTracksExtracted: audioMp4s.length });

    const videoMp4s: VideoMp4Output[] = [];
    const videoMp4sHevc: VideoMp4Output[] = [];
    const totalTasks = qualities.length * (hevcEnabled ? 2 : 1);
    const taskProgress = new Array(totalTasks).fill(0);

    const updateVideoProgress = () => {
        const total = taskProgress.reduce((a, b) => a + b, 0) / totalTasks;
        emit('qualities', 16 + (total / 100) * 66, {
            totalQualities: qualities.length,
            completedQualities: taskProgress.filter(p => p >= 100).length / (hevcEnabled ? 2 : 1),
            hevcEnabled,
        });
    };

    logger.info(
        `[transcode] Processing ${qualities.length} qualities in parallel ` +
        `(${hevcEnabled ? 'H.264 + HEVC' : 'H.264 only'}, limit: ${CONCURRENCY_LIMIT})...`
    );

    const limit = pLimit(CONCURRENCY_LIMIT);
    const tasks: Promise<void>[] = [];

    qualities.forEach((quality, qIdx) => {
        // H.264 task
        tasks.push(limit(async () => {
            const outPath = path.join(workDir, `video_${quality.name}.mp4`);
            const args = buildVideoMp4Args(inputPath, outPath, quality, h264Encoder, gopSize, isWindows);
            const taskIdx = qIdx * (hevcEnabled ? 2 : 1);

            logger.info(`[transcode] [h264] [${qIdx + 1}/${qualities.length}] Processing ${quality.name}...`);

            await runFFmpeg(
                args,
                `h264 ${quality.name}`,
                (p) => { taskProgress[taskIdx] = p; updateVideoProgress(); },
                videoInfo.duration,
                signal
            );

            taskProgress[taskIdx] = 100;
            updateVideoProgress();

            videoMp4s.push({
                quality: quality.name,
                path: outPath,
                bitrate: parseInt(quality.bitrate) * 1000,
                width: quality.width,
                height: quality.height,
                codec: 'h264',
            });
        }));

        // HEVC task
        if (hevcEnabled) {
            tasks.push(limit(async () => {
                const outPath = path.join(workDir, `video_${quality.name}_hevc.mp4`);
                const args = buildVideoMp4Args(inputPath, outPath, quality, hevcEncoder, gopSize, isWindows);
                const taskIdx = qIdx * 2 + 1;

                logger.info(`[transcode] [hevc] [${qIdx + 1}/${qualities.length}] Processing ${quality.name}...`);

                await runFFmpeg(
                    args,
                    `hevc ${quality.name}`,
                    (p) => { taskProgress[taskIdx] = p; updateVideoProgress(); },
                    videoInfo.duration,
                    signal
                );

                taskProgress[taskIdx] = 100;
                updateVideoProgress();

                videoMp4sHevc.push({
                    quality: quality.name,
                    path: outPath,
                    bitrate: Math.round(parseInt(quality.bitrate) * 0.7) * 1000,
                    width: quality.width,
                    height: quality.height,
                    codec: 'hevc',
                });
            }));
        }
    });

    await Promise.all(tasks);
    emit('qualities', 82);

    videoMp4s.sort((a, b) => a.height - b.height);
    videoMp4sHevc.sort((a, b) => a.height - b.height);

    emit('done', 85, {
        completedQualities: qualities.length,
        totalQualities: qualities.length,
        hevcEnabled,
    });

    logger.info(
        {
            videoId,
            h264: videoMp4s.length,
            hevc: videoMp4sHevc.length,
            audio: audioMp4s.length,
            subtitles: subtitles.length,
        },
        '[transcode] Transcoding complete'
    );

    return {
        videoMp4s,
        videoMp4sHevc,
        audioMp4s,
        subtitles,
        thumbnails: thumbResult,
        videoInfo,
        hevcEnabled,
    };
}