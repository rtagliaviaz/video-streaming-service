import path from 'path';
import fs from 'fs';
import { QualityProfile, AudioTrack, SubtitleTrack } from './types';
import { logger } from '../../logger';

export const generateMasterPlaylist = (
    outputPath: string,
    qualities: QualityProfile[],
    audioTracks: AudioTrack[],
    subtitleTracks: SubtitleTrack[]
): void => {
    const sortedQualities = [...qualities].sort((a, b) => a.height - b.height);

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

        sortedQualities.forEach(quality => {
            const bandwidth = parseInt(quality.bitrate) * 1000;
            masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.resolution},NAME="${quality.name}",AUDIO="${audioGroupId}",FRAME-RATE=30.000\n`;
            masterPlaylist += `playlist_${quality.name}.m3u8\n`;
        });
    } else {
        sortedQualities.forEach(quality => {
            const bandwidth = parseInt(quality.bitrate) * 1000;
            masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.resolution},NAME="${quality.name}",FRAME-RATE=30.000\n`;
            masterPlaylist += `playlist_${quality.name}.m3u8\n`;
        });
    }

    if (subtitleTracks.length > 0) {
        masterPlaylist += `\n# === SUBTITLES (WebVTT) ===\n`;
        subtitleTracks.forEach((track, index) => {
            const isDefault = track.default ? 'YES' : 'NO';
            const language = track.language || `sub${index + 1}`;
            const name = track.title || `Subtitle ${index + 1}`;
            const vttFile = `subtitle_${index}.vtt`;
            masterPlaylist += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="${language}",NAME="${name}",DEFAULT=${isDefault},AUTOSELECT=YES,URI="${vttFile}"\n`;
        });
        masterPlaylist += `\n`;
    }

    const masterPath = path.join(outputPath, 'index.m3u8');
    fs.writeFileSync(masterPath, masterPlaylist);

    logger.info(`Master playlist created with ${sortedQualities.length} qualities, ${audioTracks.length} audio tracks, ${subtitleTracks.length} subtitle tracks`);

    audioTracks.forEach((track, i) => {
        logger.debug(
            { audioIndex: i, language: track.language, codec: track.codec },
            `Audio ${i + 1}: ${track.language} (${track.codec})`
        );
    });
    subtitleTracks.forEach((track, i) => {
        logger.debug(
            { subtitleIndex: i, language: track.language, codec: track.codec },
            `Subtitle ${i + 1}: ${track.language} (${track.codec})`
        );
    });
};