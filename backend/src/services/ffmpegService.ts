import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface QualityProfile {
    name: string;
    resolution: string;
    bitrate: string;
    maxrate: string;
    bufsize: string;
    height: number;
    width: number;
}

export interface AudioTrack {
    index: number;
    language?: string;
    codec: string;
    channels: number;
    sampleRate: number;
    title?: string;
}

export interface VideoInfo {
    audioTracks: AudioTrack[];
    duration: number;
    width: number;
    height: number;
    codec: string;
}

export const getVideoInfo = async (inputPath: string): Promise<VideoInfo> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const audioTracks: AudioTrack[] = [];
            let trackIndex = 0;

            metadata.streams.forEach((stream) => {
                if (stream.codec_type === 'audio') {
                    const sampleRate = typeof stream.sample_rate === 'string' 
                        ? parseInt(stream.sample_rate) 
                        : (stream.sample_rate || 44100);

                    audioTracks.push({
                        index: trackIndex,
                        language: stream.tags?.language || `Track ${trackIndex + 1}`,
                        codec: stream.codec_name || 'unknown',
                        channels: stream.channels || 2,
                        sampleRate: typeof sampleRate === 'number' ? sampleRate : 44100,
                        title: stream.tags?.title || `Audio ${trackIndex + 1}`
                    });
                    trackIndex++;
                }
            });

            // ✅ Obtener información de video
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            
            resolve({
                audioTracks,
                duration: metadata.format.duration || 0,
                width: videoStream?.width || 0,
                height: videoStream?.height || 0,
                codec: videoStream?.codec_name || 'unknown'
            });
        });
    });
};

export const checkGPUAvailability = async (): Promise<{
    hasGPU: boolean;
    encoder: string;
    gpuInfo?: string;
}> => {
    try {
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

        console.log(`🎮 NVIDIA GPU detectada: ${gpuName}`);

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
                
                try {
                    const { stdout: testEncode } = await execAsync(
                        'ffmpeg -f lavfi -i nullsrc=size=2x2:rate=1:duration=1 -c:v h264_nvenc -f null - 2>&1'
                    );
                    
                    if (!testEncode.includes('Error') && !testEncode.includes('error')) {
                        console.log(`🚀 NVENC funcionando correctamente`);
                        return {
                            hasGPU: true,
                            encoder: 'h264_nvenc',
                            gpuInfo: gpuName
                        };
                    } else {
                        console.log(`⚠️ NVENC detectado pero no funciona correctamente, usando CPU`);
                        return { hasGPU: false, encoder: 'libx264' };
                    }
                } catch (e: any) {
                    if (e.message && !e.message.includes('nullsrc')) {
                        console.log(`⚠️ Error probando NVENC: ${e.message}`);
                        return { hasGPU: false, encoder: 'libx264' };
                    }
                    console.log(`✅ NVENC parece funcionar`);
                    return {
                        hasGPU: true,
                        encoder: 'h264_nvenc',
                        gpuInfo: gpuName
                    };
                }
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

export const QUALITY_PROFILES: QualityProfile[] = [
    {
        name: '144p',
        resolution: '256:144',
        bitrate: '150k',
        maxrate: '200k',
        bufsize: '300k',
        height: 144,
        width: 256
    },
    {
        name: '240p',
        resolution: '426:240',
        bitrate: '300k',
        maxrate: '400k',
        bufsize: '600k',
        height: 240,
        width: 426
    },
    {
        name: '360p',
        resolution: '640:360',
        bitrate: '600k',
        maxrate: '800k',
        bufsize: '1200k',
        height: 360,
        width: 640
    },
    {
        name: '480p',
        resolution: '854:480',
        bitrate: '1200k',
        maxrate: '1500k',
        bufsize: '2000k',
        height: 480,
        width: 854
    },
    {
        name: '720p',
        resolution: '1280:720',
        bitrate: '2500k',
        maxrate: '3000k',
        bufsize: '4000k',
        height: 720,
        width: 1280
    },
    {
        name: '1080p',
        resolution: '1920:1080',
        bitrate: '5000k',
        maxrate: '6000k',
        bufsize: '8000k',
        height: 1080,
        width: 1920
    },
    {
        name: '1440p',
        resolution: '2560:1440',
        bitrate: '8000k',
        maxrate: '10000k',
        bufsize: '12000k',
        height: 1440,
        width: 2560
    }
];


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
                console.error('Error getting video duration:', err);
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
                        console.log(`✅ Generated ${thumbnails.length} thumbnails for ${videoId}`);
                        resolve(thumbnails);
                    }
                }).on('error', (err) => {
                    console.error(`Error generating thumbnail ${index}:`, err);
                    completed++;
                    if (completed === commands.length) {
                        resolve(thumbnails);
                    }
                });
            });
        });
    });
};

export const generateHLS = async (
    inputPath: string,
    outputDir: string,
    videoId: string,
    onProgress: (percent: number) => void,
    qualities: QualityProfile[] = QUALITY_PROFILES
): Promise<{ masterPlaylist: string; thumbnails: string[]; audioTracks: AudioTrack[] }> => {
    const videoInfo = await getVideoInfo(inputPath);
    console.log(`📊 Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`);
    console.log(`🎵 Pistas de audio encontradas: ${videoInfo.audioTracks.length}`);
    videoInfo.audioTracks.forEach((track, i) => {
        console.log(`   Audio ${i + 1}: ${track.language} (${track.codec}, ${track.channels}ch)`);
    });

    const gpuInfo = await checkGPUAvailability();
    const encoder = gpuInfo.hasGPU ? 'h264_nvenc' : 'libx264';
    
    console.log(`Usando encoder: ${encoder}${gpuInfo.hasGPU ? ` (GPU: ${gpuInfo.gpuInfo})` : ' (CPU)'}`);

    return new Promise(async (resolve, reject) => {
        const outputPath = path.join(outputDir, videoId);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        let thumbnails: string[] = [];
        generateThumbnails(inputPath, outputDir, videoId, 10)
            .then((thumbs) => {
                thumbnails = thumbs;
                console.log(`📸 Thumbnails generados: ${thumbs.length}`);
            })
            .catch((err) => {
                console.warn('⚠️ Error generando thumbnails:', err);
            });

        // ✅ Generar variantes para cada calidad
        const variantStreams = qualities.map((quality, index) => {
            const segmentName = `segment_${quality.name}_%03d.ts`;
            const playlistName = `playlist_${quality.name}.m3u8`;
            
            const nvencOptions = encoder === 'h264_nvenc' ? [
                '-rc', 'vbr',
                '-cq', '23',
                '-spatial_aq', '1',
                '-temporal_aq', '1',
                '-rc-lookahead', '32',
                '-no-scenecut', '1',
                '-b_ref_mode', '0'
            ] : [];

            return {
                ...quality,
                segmentPath: path.join(outputPath, segmentName),
                playlistPath: path.join(outputPath, playlistName),
                output: path.join(outputPath, playlistName),
                index,
                encoder,
                nvencOptions
            };
        });

        const command = ffmpeg(inputPath);

        variantStreams.forEach((stream) => {
            const outputOptions = [
                '-f', 'hls',
                '-hls_time', '6',
                '-hls_list_size', '0',
                '-hls_playlist_type', 'vod',
                '-c:v', stream.encoder,
                '-preset', stream.encoder === 'h264_nvenc' ? 'p4' : 'fast',
                '-b:v', stream.bitrate,
                '-maxrate', stream.maxrate,
                '-bufsize', stream.bufsize,
                '-c:a', 'copy', 
                '-vf', `scale=${stream.resolution}:flags=lanczos`,
                '-hls_segment_filename', stream.segmentPath,
                ...stream.nvencOptions
            ];

            command.output(stream.output)
                .outputOptions(outputOptions);
        });

        let lastProgress = 0;
        const startTime = Date.now();

        command
            .on('start', (cmd) => {
                console.log('🔧 FFmpeg command (truncated):', cmd.substring(0, 200) + '...');
                console.log(`📊 Procesando ${variantStreams.length} calidades con ${encoder}`);
                console.log(`🎵 Incluyendo ${videoInfo.audioTracks.length} pistas de audio`);
            })
            .on('progress', (progress) => {
                const percent = Math.round(progress.percent || 0);
                if (percent > lastProgress) {
                    lastProgress = percent;
                    onProgress(percent);
                }
            })
            .on('end', async () => {
                onProgress(100);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`✅ HLS generado en ${elapsed}s usando ${encoder}`);
                
                // ✅ Generar playlist maestro incluyendo información de audio
                generateMasterPlaylist(outputPath, variantStreams, videoInfo.audioTracks);
                
                // Esperar thumbnails
                let thumbnailTimeout = 0;
                while (thumbnails.length === 0 && thumbnailTimeout < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    thumbnailTimeout++;
                }
                
                resolve({ 
                    masterPlaylist: path.join(outputPath, 'index.m3u8'),
                    thumbnails,
                    audioTracks: videoInfo.audioTracks
                });
            })
            .on('error', (err) => {
                console.error('❌ FFmpeg error:', err);
                if (encoder === 'h264_nvenc' && err.message.includes('nvenc')) {
                    console.log('🔄 Falló NVENC, reintentando con CPU...');
                    generateHLS(inputPath, outputDir, videoId, onProgress, qualities)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(err);
                }
            })
            .run();
    });
};

// ✅ Generar playlist maestro con información de audio
function generateMasterPlaylist(outputPath: string, streams: any[], audioTracks: AudioTrack[]) {
    const sortedStreams = [...streams].sort((a, b) => a.height - b.height);
    
    let masterPlaylist = `#EXTM3U
#EXT-X-VERSION:6

`;

    // ✅ Agregar información de las pistas de audio (para que el reproductor sepa que existen)
    if (audioTracks.length > 1) {
        masterPlaylist += `# ✅ Audio tracks available: ${audioTracks.length}\n`;
        audioTracks.forEach((track, i) => {
            masterPlaylist += `# Audio ${i + 1}: ${track.language} (${track.codec}, ${track.channels}ch)\n`;
        });
        masterPlaylist += `\n`;
    }

    // ✅ Agregar cada stream de video
    sortedStreams.forEach(stream => {
        const bandwidth = parseInt(stream.bitrate) * 1000;
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${stream.resolution},NAME="${stream.name}",FRAME-RATE=30.000
playlist_${stream.name}.m3u8\n`;
    });

    const masterPath = path.join(outputPath, 'index.m3u8');
    fs.writeFileSync(masterPath, masterPlaylist);
    
    console.log(`📋 Master playlist creada con ${sortedStreams.length} calidades`);
    console.log(`🎵 ${audioTracks.length} pistas de audio disponibles`);
    audioTracks.forEach((track, i) => {
        console.log(`   Audio ${i + 1}: ${track.language} (${track.codec})`);
    });
    
    const debugPath = path.join(outputPath, 'master_debug.m3u8');
    fs.writeFileSync(debugPath, masterPlaylist);
}