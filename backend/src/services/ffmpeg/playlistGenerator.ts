import path from 'path';
import fs from 'fs';
import { QualityProfile, AudioTrack, SubtitleTrack } from './types';

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

    // add EXT-X-MEDIA for audio if at least 1 track
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

    console.log(`📋 Master playlist creada con ${sortedQualities.length} calidades`);
    console.log(`🎵 ${audioTracks.length} pistas de audio disponibles`);
    audioTracks.forEach((track, i) => {
        console.log(`   Audio ${i + 1}: ${track.language} (${track.codec})`);
    });
    console.log(`📝 ${subtitleTracks.length} pistas de subtítulos disponibles`);
    subtitleTracks.forEach((track, i) => {
        console.log(`   Subtitle ${i + 1}: ${track.language} (${track.codec})`);
    });
};