import path from 'path';
import fs from 'fs';
import { QualityProfile, AudioTrack, SubtitleTrack, CodecVariant } from './types';
import { logger } from '../../logger';

export const generateMasterPlaylist = (
    outputPath: string,
    codecVariants: CodecVariant[],
    audioTracks: AudioTrack[],
    subtitleTracks: SubtitleTrack[]
): string => {
    let masterPlaylist = `#EXTM3U
#EXT-X-VERSION:6

`;

    if (audioTracks.length > 0) {
        const audioGroupId = 'audio-group';
        audioTracks.forEach((track, index) => {
            const isDefault = index === 0 ? 'YES' : 'NO';
            const language = track.language || `track${index + 1}`;
            const name = track.title || `Audio ${index + 1}`;
            const audioPlaylist = `audio_${index}.m3u8`;
            masterPlaylist += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="${audioGroupId}",LANGUAGE="${language}",NAME="${name}",DEFAULT=${isDefault},AUTOSELECT=YES,URI="${audioPlaylist}"\n`;
        });
        masterPlaylist += `\n`;
    }

    if (subtitleTracks.length > 0) {
        subtitleTracks.forEach((track, index) => {
            const isDefault = track.default ? 'YES' : 'NO';
            const language = track.language || `sub${index + 1}`;
            const name = track.title || `Subtitle ${index + 1}`;
            const vttFile = `subtitle_${index}.vtt`;
            masterPlaylist += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="${language}",NAME="${name}",DEFAULT=${isDefault},AUTOSELECT=YES,URI="${vttFile}"\n`;
        });
        masterPlaylist += `\n`;
    }

    for (const variant of codecVariants) {
        let codecString = '';
        if (variant.codecName === 'hevc') {
            codecString = 'hvc1.1.6.L123.0'; // HEVC main profile, level 3.1
        } else {
            codecString = 'avc1.640028'; // H.264 high profile, level 4.0
        }

        const sortedQualities = [...variant.qualities].sort((a, b) => a.height - b.height);

        for (const quality of sortedQualities) {
            const bandwidth = parseInt(quality.bitrate) * 1000;
            const resolution = quality.resolution;
            const playlistFile = `playlist_${variant.codecName}_${quality.name}.m3u8`;

            // ajustar bandwidth para HEVC (menor bitrate para la misma calidad)
            const adjustedBandwidth = variant.codecName === 'hevc'
                ? Math.round(bandwidth * 0.7) // HEVC es ~30% más eficiente
                : bandwidth;

            let streamLine = `#EXT-X-STREAM-INF:BANDWIDTH=${adjustedBandwidth}`;
            streamLine += `,RESOLUTION=${resolution}`;
            streamLine += `,NAME="${quality.name} (${variant.codecName.toUpperCase()})"`;
            streamLine += `,CODECS="${codecString}"`;

            if (audioTracks.length > 0) {
                streamLine += `,AUDIO="audio-group"`;
            }

            if (subtitleTracks.length > 0) {
                streamLine += `,SUBTITLES="subs"`;
            }

            masterPlaylist += `${streamLine}\n`;
            masterPlaylist += `${playlistFile}\n`;
        }
    }

    const masterPath = path.join(outputPath, 'index.m3u8');
    fs.writeFileSync(masterPath, masterPlaylist);

    logger.info(`Master playlist created with ${codecVariants.length} codec variants`);
    for (const variant of codecVariants) {
        logger.info(`  - ${variant.codecName.toUpperCase()}: ${variant.qualities.length} qualities (encoder: ${variant.encoder})`);
    }
    logger.info(`  - ${audioTracks.length} audio tracks, ${subtitleTracks.length} subtitle tracks`);

    return masterPath;
}