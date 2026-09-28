import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { TranscodeResult } from './transcodeToMp4';
import { logger } from '../../logger';
import { config } from '../../config';

export interface EncryptOptions {
    transcode: TranscodeResult;
    outputDir: string;
    videoId: string;
    kid: string;
    keyHex: string;
    licenseBaseUrl: string;
    segmentDuration?: number;
    signal?: AbortSignal;
}

export interface HlsEncryptedResult {
    hlsDir: string;
    masterPlaylist: string;
    videoPlaylists: { quality: string; playlist: string }[];
    audioPlaylists: { index: number; playlist: string }[];
}

function runPackager(
    args: string[],
    label: string,
    cwd: string,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('CANCELLED'));

        const packagerPath = path.resolve(config.drm.packagerPath);
        if (!fs.existsSync(packagerPath)) {
            return reject(new Error(`Shaka Packager not found at ${packagerPath}`));
        }

        const proc = spawn(packagerPath, args, { cwd, windowsHide: true, signal });
        let stderr = '';
        let stdout = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code, sig) => {
            if (signal?.aborted || sig === 'SIGTERM') return reject(new Error('CANCELLED'));
            if (code === 0) return resolve();
            logger.error(
                { label, code, stderr: stderr.slice(-2000), stdout: stdout.slice(-500) },
                `[hls-encrypt] Shaka Packager failed for ${label}`
            );
            reject(new Error(`Shaka Packager (${label}) exited with code ${code}`));
        });

        proc.on('error', (err: any) => {
            if (err?.name === 'AbortError' || signal?.aborted) return reject(new Error('CANCELLED'));
            reject(err);
        });
    });
}

/**
  encrypted HSL (AES-128) whole-segment with Shaka Packager
  fMP4/CMAF
 
  output structure:
    hls/
      master.m3u8
      video_480p/playlist.m3u8 + init.mp4 + *.m4s
      video_720p/playlist.m3u8 + init.mp4 + *.m4s
      audio_0/playlist.m3u8 + init.mp4 + *.m4s
      thumbnails/...
      subtitle_0.vtt
 */
export async function encryptHLS(options: EncryptOptions): Promise<HlsEncryptedResult> {
    const {
        transcode,
        outputDir,
        videoId,
        kid,
        keyHex,
        licenseBaseUrl,
        segmentDuration = 2,
        signal,
    } = options;

    const hlsDir = path.join(outputDir, videoId, 'hls');
    if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });

    const keyUri = `${licenseBaseUrl}/api/license/${kid}`;

    logger.info(
        {
            videoId,
            kid,
            keyUri,
            qualities: transcode.videoMp4s.length,
            audios: transcode.audioMp4s.length,
        },
        '[hls-encrypt] Starting HLS encryption with Shaka Packager'
    );

    for (const v of transcode.videoMp4s) {
        fs.mkdirSync(path.join(hlsDir, `video_${v.quality}`), { recursive: true });
    }
    for (const a of transcode.audioMp4s) {
        fs.mkdirSync(path.join(hlsDir, `audio_${a.index}`), { recursive: true });
    }

    // shaka arguments
    const args: string[] = [];
    
    for (const video of transcode.videoMp4s) {
        const relPath = path.relative(hlsDir, video.path).replace(/\\/g, '/');
        const outDir = `video_${video.quality}`;
        args.push(
            `in=${relPath},` +
            `stream=video,` +
            `init_segment=${outDir}/init.mp4,` +
            `segment_template=${outDir}/$Number$.m4s,` +
            `playlist_name=${outDir}/playlist.m3u8`
        );
    }

    for (const audio of transcode.audioMp4s) {
        const relPath = path.relative(hlsDir, audio.path).replace(/\\/g, '/');
        const outDir = `audio_${audio.index}`;
        const lang = (audio.language || `und`).toLowerCase().slice(0, 3);
        args.push(
            `in=${relPath},` +
            `stream=audio,` +
            `init_segment=${outDir}/init.mp4,` +
            `segment_template=${outDir}/$Number$.m4s,` +
            `playlist_name=${outDir}/playlist.m3u8,` +
            `hls_group_id=audio,` +
            `hls_name=${audio.language},` +
            `lang=${lang}`
        );
    }

    // encryption args
    args.push('--enable_raw_key_encryption');
    args.push('--keys', `key_id=${kid}:key=${keyHex}`);
    args.push('--protection_scheme', 'aes128');
    args.push('--clear_lead', '0');
    args.push('--hls_key_uri', keyUri);

    // HLS output
    args.push('--segment_duration', String(segmentDuration));
    args.push('--hls_master_playlist_output', 'shaka_master.m3u8');

    await runPackager(args, 'HLS all variants', hlsDir, signal);

    // Shaka genera un master básico. Lo borramos y generamos el nuestro
    // (que incluye subtítulos y naming más limpio).
    const shakaMaster = path.join(hlsDir, 'shaka_master.m3u8');
    try { if (fs.existsSync(shakaMaster)) fs.unlinkSync(shakaMaster); } catch {}

    if (transcode.thumbnails.thumbnails.length > 0) {
        const srcThumbs = path.join(outputDir, videoId, 'thumbnails');
        const dstThumbs = path.join(hlsDir, 'thumbnails');
        if (fs.existsSync(srcThumbs)) {
            fs.renameSync(srcThumbs, dstThumbs);
        }
    }

    for (const sub of transcode.subtitles) {
        const vttName = `subtitle_${sub.index}.vtt`;
        const dst = path.join(hlsDir, vttName);

        if (fs.existsSync(sub.path)) {
            fs.copyFileSync(sub.path, dst);
        }

        // playlist m3u8 -> VTT
        const duration = Math.ceil(transcode.videoInfo.duration || 0);
        const subPlaylistName = `subtitle_${sub.index}.m3u8`;
        const subPlaylistPath = path.join(hlsDir, subPlaylistName);
        const subPlaylistContent = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            `#EXT-X-TARGETDURATION:${duration}`,
            '#EXT-X-MEDIA-SEQUENCE:0',
            '#EXT-X-PLAYLIST-TYPE:VOD',
            `#EXTINF:${duration}.0,`,
            vttName,
            '#EXT-X-ENDLIST',
        ].join('\n');
        fs.writeFileSync(subPlaylistPath, subPlaylistContent, 'utf-8');
    }

    
    const masterPath = path.join(hlsDir, 'master.m3u8');
    generateMasterPlaylist(masterPath, transcode);

    logger.info(
        { videoId, masterPath },
        '[hls-encrypt] HLS encryption complete'
    );

    return {
        hlsDir,
        masterPlaylist: masterPath,
        videoPlaylists: transcode.videoMp4s.map(v => ({
            quality: v.quality,
            playlist: path.join(hlsDir, `video_${v.quality}`, 'playlist.m3u8'),
        })),
        audioPlaylists: transcode.audioMp4s.map(a => ({
            index: a.index,
            playlist: path.join(hlsDir, `audio_${a.index}`, 'playlist.m3u8'),
        })),
    };
}


function generateMasterPlaylist(outputPath: string, transcode: TranscodeResult): void {
    const lines: string[] = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-INDEPENDENT-SEGMENTS',
        '',
    ];

    const hasAudio = transcode.audioMp4s.length > 0;
    const hasSubs = transcode.subtitles.length > 0;

    for (const audio of transcode.audioMp4s) {
        const name = audio.language || `Audio ${audio.index + 1}`;
        const lang = (audio.language || 'und').toLowerCase().slice(0, 3);
        const isDefault = audio.index === 0 ? 'YES' : 'NO';
        const audioUri = `audio_${audio.index}/playlist.m3u8`;

        lines.push(
            `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${name}",LANGUAGE="${lang}",` +
            `DEFAULT=${isDefault},AUTOSELECT=YES,CHANNELS="${audio.channels || 2}",URI="${audioUri}"`
        );
    }
    if (hasAudio) lines.push('');

    /* NOTA: HLS.js requiere que las pistas de subtítulos apunten a un playlist .m3u8,
      no a un .vtt directo. Por ahora los omitimos del master y los añadimos desde el frontend como <track> del <video>.
    */ 
    for (const sub of transcode.subtitles) {
        const lang = (sub.language || `sub${sub.index}`).toLowerCase().slice(0, 3);
        const isDefault = sub.index === 0 ? 'YES' : 'NO';

        lines.push(
            `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${sub.language}",LANGUAGE="${lang}",` +
            `DEFAULT=${isDefault},AUTOSELECT=YES,URI="subtitle_${sub.index}.m3u8"`
        );
    }
    if (hasSubs) lines.push('');

    for (const video of transcode.videoMp4s) {
        const bandwidth = video.bitrate;
        const resolution = `${video.width}x${video.height}`;
        const codecs = 'avc1.64001f,mp4a.40.2';

        const audioAttr = hasAudio ? ',AUDIO="audio"' : '';
        // const subsAttr = hasSubs ? ',SUBTITLES="subs"' : '';
        const subsAttr = '';

        lines.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},` +
            `CODECS="${codecs}"${audioAttr}${subsAttr}`
        );
        lines.push(`video_${video.quality}/playlist.m3u8`);
        lines.push('');
    }

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}