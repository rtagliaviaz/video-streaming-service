import { useState, useEffect } from 'react';
import { videoApi } from '../../../services/api';
import type { AudioTrack, SubtitleTrack } from '../types';

interface UseVideoInfoProps {
    videoId: string | null;
    hlsUrl?: string | null;
}

export const useVideoInfo = ({ videoId, hlsUrl = null }: UseVideoInfoProps) => {
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!videoId) {
            setAudioTracks([]);
            setSubtitleTracks([]);
            return;
        }

        const fetchVideoInfo = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await videoApi.getVideoInfo(videoId);
                let subs = response.data.subtitleTracks || [];

                // If the backend didn't provide subtitles AND we have an HLS URL,
                // parse the master playlist from the CDN.
                if (subs.length === 0 && hlsUrl) {
                    console.log('📝 Backend returned no subtitles, parsing HLS manifest from CDN...');

                    try {
                        const manifestResponse = await fetch(hlsUrl);
                        if (!manifestResponse.ok) {
                            throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
                        }
                        const manifestText = await manifestResponse.text();

                        const lines = manifestText.split('\n');
                        const subtitleLines = lines.filter(line =>
                            line.includes('TYPE=SUBTITLES') || line.includes('TYPE="SUBTITLES"')
                        );

                        console.log(`📝 Found ${subtitleLines.length} subtitle lines in manifest`);

                        subtitleLines.forEach((line, index) => {
                            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
                            const nameMatch = line.match(/NAME="([^"]+)"/);
                            const uriMatch = line.match(/URI="([^"]+)"/);

                            if (uriMatch) {
                                subs.push({
                                    index: index,
                                    language: langMatch ? langMatch[1] : `Subtitle ${index + 1}`,
                                    codec: 'webvtt',
                                    title: nameMatch ? nameMatch[1] : `Subtitle ${index + 1}`,
                                    default: index === 0,
                                });
                            }
                        });

                        console.log(`📝 ${subs.length} subtitles extracted from manifest`);
                    } catch (manifestError) {
                        // Not fatal — the video plays regardless.
                        console.warn('⚠️ Could not read HLS manifest for subtitles:', manifestError);
                    }
                }

                setSubtitleTracks(subs);
                setAudioTracks(response.data.audioTracks || []);
            } catch (err) {
                console.error('Error fetching video info:', err);
                setError('Failed to load video info');
            } finally {
                setIsLoading(false);
            }
        };

        fetchVideoInfo();
    }, [videoId, hlsUrl]);

    return { audioTracks, subtitleTracks, isLoading, error };
};