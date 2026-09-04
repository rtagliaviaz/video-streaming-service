import ffmpeg from 'fluent-ffmpeg';
import { VideoInfo, AudioTrack, SubtitleTrack } from './types';

function formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const getVideoInfo = async (inputPath: string): Promise<VideoInfo> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const audioTracks: AudioTrack[] = [];
            const subtitleTracks: SubtitleTrack[] = [];
            let audioIndex = 0;
            let subtitleIndex = 0;

            metadata.streams.forEach((stream) => {
                if (stream.codec_type === 'audio') {
                    const sampleRate = typeof stream.sample_rate === 'string'
                        ? parseInt(stream.sample_rate)
                        : (stream.sample_rate || 44100);

                    audioTracks.push({
                        index: audioIndex,
                        language: stream.tags?.language || `Track ${audioIndex + 1}`,
                        codec: stream.codec_name || 'unknown',
                        channels: stream.channels || 2,
                        sampleRate: typeof sampleRate === 'number' ? sampleRate : 44100,
                        title: stream.tags?.title || `Audio ${audioIndex + 1}`
                    });
                    audioIndex++;
                }

                if (stream.codec_type === 'subtitle') {
                    subtitleTracks.push({
                        index: subtitleIndex,
                        language: stream.tags?.language || `Subtitle ${subtitleIndex + 1}`,
                        codec: stream.codec_name || 'unknown',
                        title: stream.tags?.title || `Subtitle ${subtitleIndex + 1}`,
                        default: stream.tags?.default === '1' || false
                    });
                    subtitleIndex++;
                }
            });

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const durationInSeconds = metadata.format.duration || 0;
            const durationFormatted = formatDuration(durationInSeconds);

            resolve({
                audioTracks,
                subtitleTracks,
                duration: durationInSeconds,
                durationFormatted, 
                width: videoStream?.width || 0,
                height: videoStream?.height || 0,
                codec: videoStream?.codec_name || 'unknown'
            });
        });
    });
};