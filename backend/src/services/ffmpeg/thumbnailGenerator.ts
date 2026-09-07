import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { logger } from '../../logger';

export const generateThumbnails = async (
    inputPath: string,
    outputDir: string,
    videoId: string,
    numThumbnails: number = 10
): Promise<string[]> => {
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
            const interval = duration / (numThumbnails + 1);
            const thumbnails: string[] = [];

            const commands = [];
            for (let i = 1; i <= numThumbnails; i++) {
                const time = i * interval;
                const outputFile = path.join(thumbDir, `thumb_${String(i).padStart(3, '0')}.jpg`);
                thumbnails.push(`/api/thumbnails/${videoId}/${path.basename(outputFile)}`);

                const cmd = ffmpeg(inputPath)
                    .screenshots({
                        timestamps: [time],
                        filename: path.basename(outputFile),
                        folder: thumbDir,
                        size: '320x180'
                    });
                commands.push(cmd);
            }

            let completed = 0;
            commands.forEach((cmd, index) => {
                cmd.on('end', () => {
                    completed++;
                    if (completed === commands.length) {
                        logger.info(`Generated ${thumbnails.length} thumbnails for ${videoId}`);
                        resolve(thumbnails);
                    }
                }).on('error', (err) => {
                    logger.warn({ error: err.message, index, videoId }, `Error generating thumbnail ${index}`);
                    completed++;
                    if (completed === commands.length) {
                        resolve(thumbnails);
                    }
                });
            });
        });
    });
};