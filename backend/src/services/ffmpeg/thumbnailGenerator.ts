import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../../logger';

const SPRITE_COLS = 8;
const SPRITE_ROWS = 5;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const NUM_THUMBNAILS = SPRITE_COLS * SPRITE_ROWS; 

export const generateThumbnails = async (
    inputPath: string,
    outputDir: string,
    videoId: string,
    numThumbnails: number = NUM_THUMBNAILS
): Promise<{
    thumbnails: string[];
    sprite: string;
    vtt: string;
}> => {
    return new Promise((resolve, reject) => {
        const thumbDir = path.join(outputDir, videoId, 'thumbnails');
        if (!fs.existsSync(thumbDir)) {
            fs.mkdirSync(thumbDir, { recursive: true });
        }

        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                logger.error({ error: err.message }, 'Error getting video duration for thumbnails');
                reject(err);
                return;
            }

            const duration = metadata.format.duration || 0;
            if (duration === 0) {
                logger.warn('Video duration is 0, cannot generate thumbnails');
                resolve({
                    thumbnails: [],
                    sprite: '',
                    vtt: ''
                });
                return;
            }

            const interval = duration / (numThumbnails + 1);
            const timestamps: number[] = [];
            for (let i = 1; i <= numThumbnails; i++) {
                timestamps.push(i * interval);
            }

            const spriteFilename = 'sprite.jpg';
            const spritePath = path.join(thumbDir, spriteFilename);
            const vttFilename = 'thumbnails.vtt';
            const vttPath = path.join(thumbDir, vttFilename);

            const individualUrls: string[] = [];
            const commands: ffmpeg.FfmpegCommand[] = [];
            for (let i = 0; i < timestamps.length; i++) {
                const time = timestamps[i];
                const outputFile = path.join(thumbDir, `thumb_${String(i + 1).padStart(3, '0')}.jpg`);
                individualUrls.push(`/api/thumbnails/${videoId}/${path.basename(outputFile)}`);

                const cmd = ffmpeg(inputPath)
                    .screenshots({
                        timestamps: [time],
                        filename: path.basename(outputFile),
                        folder: thumbDir,
                        size: `${THUMB_WIDTH}x${THUMB_HEIGHT}`
                    });
                commands.push(cmd);
            }

            let completed = 0;
            commands.forEach((cmd, index) => {
                cmd.on('end', () => {
                    completed++;
                    if (completed === commands.length) {

                        const cols = Math.min(SPRITE_COLS, numThumbnails);
                        const rows = Math.ceil(numThumbnails / cols);

                        const isWindows = process.platform === 'win32';
                        let spriteArgs: string[];

                        if (isWindows) {
                            const listFile = path.join(thumbDir, 'files.txt');
                            try {
                                const files = fs.readdirSync(thumbDir)
                                    .filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
                                    .sort()
                                    .map(f => `file '${f}'`)
                                    .join('\n');
                                fs.writeFileSync(listFile, files);

                                spriteArgs = [
                                    '-f', 'concat',
                                    '-safe', '0',
                                    '-i', listFile,
                                    '-vf', `tile=${cols}x${rows}:margin=4:padding=4`,
                                    '-frames:v', '1',
                                    '-q:v', '2',
                                    spritePath
                                ];
                            } catch (err) {
                                logger.error({ error: err }, 'Error creating file list for sprite');
                                resolve({
                                    thumbnails: individualUrls,
                                    sprite: '',
                                    vtt: ''
                                });
                                return;
                            }
                        } else {
                            spriteArgs = [
                                '-pattern_type', 'glob',
                                '-i', path.join(thumbDir, 'thumb_*.jpg'),
                                '-vf', `tile=${cols}x${rows}:margin=4:padding=4`,
                                '-frames:v', '1',
                                '-q:v', '2',
                                spritePath
                            ];
                        }

                        const spriteProc = spawn('ffmpeg', spriteArgs, { windowsHide: true });

                        let stderr = '';
                        spriteProc.stderr.on('data', (data) => {
                            stderr += data.toString();
                        });

                        spriteProc.on('close', (code) => {
                            if (isWindows) {
                                const listFile = path.join(thumbDir, 'files.txt');
                                if (fs.existsSync(listFile)) {
                                    fs.unlinkSync(listFile);
                                }
                            }

                            if (code === 0) {
                                const vttContent = generateVttContent(
                                    numThumbnails,
                                    cols,
                                    rows,
                                    interval,
                                    THUMB_WIDTH,
                                    THUMB_HEIGHT,
                                    spriteFilename
                                );
                                try {
                                    fs.writeFileSync(vttPath, vttContent);
                                    logger.info({
                                        videoId,
                                        individual: individualUrls.length,
                                        sprite: `/api/thumbnails/${videoId}/${spriteFilename}`,
                                        vtt: `/api/thumbnails/${videoId}/${vttFilename}`
                                    }, `Thumbnails generated: ${individualUrls.length} individual, sprite + vtt`);
                                    resolve({
                                        thumbnails: individualUrls,
                                        sprite: `/api/thumbnails/${videoId}/${spriteFilename}`,
                                        vtt: `/api/thumbnails/${videoId}/${vttFilename}`
                                    });
                                } catch (err) {
                                    logger.error({ error: err }, 'Error writing VTT file');
                                    resolve({
                                        thumbnails: individualUrls,
                                        sprite: `/api/thumbnails/${videoId}/${spriteFilename}`,
                                        vtt: ''
                                    });
                                }
                            } else {
                                logger.error({ code, stderr }, 'Error generating sprite');
                                resolve({
                                    thumbnails: individualUrls,
                                    sprite: '',
                                    vtt: ''
                                });
                            }
                        });

                        spriteProc.on('error', (err) => {
                            logger.error({ error: err.message }, 'Sprite generation error');
                            resolve({
                                thumbnails: individualUrls,
                                sprite: '',
                                vtt: ''
                            });
                        });
                    }
                }).on('error', (err) => {
                    logger.warn({ error: err.message, index }, `Error generating thumbnail ${index}`);
                    completed++;
                    if (completed === commands.length) {
                        resolve({
                            thumbnails: individualUrls,
                            sprite: '',
                            vtt: ''
                        });
                    }
                });
            });
        });
    });
};

function generateVttContent(
    num: number,
    cols: number,
    rows: number,
    interval: number,
    width: number,
    height: number,
    spriteFilename: string
): string {
    let vtt = 'WEBVTT\n\n';
    for (let i = 0; i < num; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * (width + 4) + 4;
        const y = row * (height + 4) + 4;
        const start = i * interval;
        const end = (i + 1) * interval;
        const startStr = formatTime(start);
        const endStr = formatTime(end);
        vtt += `${startStr}.000 --> ${endStr}.000\n`;
        vtt += `${spriteFilename}#xywh=${x},${y},${width},${height}\n\n`;
    }
    return vtt;
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}