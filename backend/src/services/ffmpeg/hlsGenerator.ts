import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { QualityProfile, HLSResult } from './types';
import { QUALITY_PROFILES, HLS_CONFIG } from './config';
import { getVideoInfo } from './videoInfo';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { generateMasterPlaylist } from './playlistGenerator';

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

        // generar audio separado siempre que haya al menos 1 pista
        if (videoInfo.audioTracks.length > 0) {
            console.log(`🎵 Generando ${videoInfo.audioTracks.length} playlists de audio separadas...`);
            for (let i = 0; i < videoInfo.audioTracks.length; i++) {
                const audioPlaylist = `audio_${i}.m3u8`;
                const audioOutput = path.join(outputPath, audioPlaylist);
                const audioCmd = `ffmpeg -i "${inputPath}" -map 0:a:${i} -c:a aac -b:a ${HLS_CONFIG.audioBitrate} -f hls -hls_time ${HLS_CONFIG.segmentDuration} -hls_list_size 0 -hls_playlist_type vod -hls_segment_filename "${path.join(outputPath, `audio_${i}_%03d.ts`)}" "${audioOutput}"`;
                try {
                    await new Promise((resolveAudio, rejectAudio) => {
                        const proc = spawn(audioCmd, { shell: true });
                        proc.on('close', (code) => {
                            if (code === 0) resolveAudio(null);
                            else rejectAudio(new Error(`Audio ${i} failed with code ${code}`));
                        });
                        proc.on('error', rejectAudio);
                    });
                    console.log(`   ✅ Audio ${i + 1} (${videoInfo.audioTracks[i].language || 'track'}) generado`);
                } catch (err) {
                    console.warn(`⚠️ Error generando audio ${i}:`, err);
                }
            }
        }

        // subtitles generator
        if (videoInfo.subtitleTracks.length > 0) {
            console.log('📝 Generando archivos de subtítulos WebVTT...');
            for (let i = 0; i < videoInfo.subtitleTracks.length; i++) {
                const lang = videoInfo.subtitleTracks[i].language || `sub${i}`;
                const vttFile = `subtitle_${i}.vtt`;
                const vttPath = path.join(outputPath, vttFile);
                const subtitleCmd = `ffmpeg -i "${inputPath}" -map 0:s:${i} -c:s webvtt "${vttPath}"`;
                try {
                    await new Promise((resolveSub, rejectSub) => {
                        const proc = spawn(subtitleCmd, { shell: true });
                        proc.on('close', (code) => {
                            if (code === 0) resolveSub(null);
                            else rejectSub(new Error(`Subtitle ${i} failed with code ${code}`));
                        });
                        proc.on('error', rejectSub);
                    });
                    console.log(`   ✅ Subtítulo ${i + 1} (${lang}) generado`);
                } catch (err) {
                    console.warn(`⚠️ Error generando subtítulo ${i}:`, err);
                }
            }
        }

        // procesar quality solo videos sin audio
        console.log(`🔧 Procesando ${qualities.length} calidades con NVENC...`);
        
        let totalProgress = 0;
        const progressPerQuality = 100 / qualities.length;

        for (let qIndex = 0; qIndex < qualities.length; qIndex++) {
            const quality = qualities[qIndex];
            const segmentName = `segment_${quality.name}_%03d.ts`;
            const playlistName = `playlist_${quality.name}.m3u8`;
            const outputFile = path.join(outputPath, playlistName);
            const segmentPath = path.join(outputPath, segmentName);

            const nvencOpts = encoder === 'h264_nvenc' ? 
                ` -rc vbr -cq 23 -spatial_aq 1 -temporal_aq 1 -rc-lookahead 32 -no-scenecut 1 -b_ref_mode 0` : '';

            // video without audio
            const commandStr = 
                `ffmpeg -i "${inputPath}"` +
                ` -map 0:v:0` +
                ` -c:v ${encoder}` +
                ` -preset ${encoder === 'h264_nvenc' ? 'p4' : 'fast'}` +
                ` -b:v ${quality.bitrate}` +
                ` -maxrate ${quality.maxrate}` +
                ` -bufsize ${quality.bufsize}` +
                ` -vf scale=${quality.resolution}:flags=lanczos` +
                nvencOpts +
                ` -an` + 
                ` -f hls` +
                ` -hls_time ${HLS_CONFIG.segmentDuration}` +
                ` -hls_list_size 0` +
                ` -hls_playlist_type vod` +
                ` -hls_segment_filename "${segmentPath}"` +
                ` "${outputFile}"`;

            console.log(`  📹 [${qIndex + 1}/${qualities.length}] Procesando ${quality.name}...`);

            try {
                let qualityProgress = 0;
                const startTime = Date.now();
                
                await new Promise((resolveCmd, rejectCmd) => {
                    const proc = spawn(commandStr, { shell: true });
                    
                    let duration = 0;
                    
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
                                
                                if (percent > qualityProgress) {
                                    qualityProgress = percent;
                                    
                                    const qualityContribution = (percent / 100) * progressPerQuality;
                                    totalProgress = (qIndex * progressPerQuality) + qualityContribution;
                                    
                                    onProgress(Math.min(Math.round(totalProgress), 100));
                                    
                                    if (percent % 10 === 0 || percent === 100) {
                                        console.log(`     ${quality.name}: ${percent}% (${Math.round(totalProgress)}% total)`);
                                    }
                                }
                            }
                        }
                    });

                    proc.on('close', (code) => {
                        if (code === 0) {
                            qualityProgress = 100;
                            totalProgress = (qIndex + 1) * progressPerQuality;
                            onProgress(Math.min(Math.round(totalProgress), 100));
                            
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`     ✅ ${quality.name} completado en ${elapsed}s (${Math.round(totalProgress)}% total)`);
                            resolveCmd(null);
                        } else {
                            rejectCmd(new Error(`FFmpeg exited with code ${code} for ${quality.name}`));
                        }
                    });
                    proc.on('error', rejectCmd);
                });
            } catch (err) {
                console.error(`❌ Error en calidad ${quality.name}:`, err);
                reject(err);
                return;
            }
        }

        console.log(`✅ HLS generado usando ${encoder} (${qualities.length} calidades)`);
        
        // always EXT-X-MEDIA for audios
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