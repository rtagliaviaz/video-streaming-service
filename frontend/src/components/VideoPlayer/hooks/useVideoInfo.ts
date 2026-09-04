import { useState, useEffect } from 'react';
import { videoApi } from '../../../services/api';
import type { AudioTrack, SubtitleTrack } from '../types';

export const useVideoInfo = (videoId: string | null) => {
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
                console.log('📊 Backend response:', response.data);
                
                let subs = response.data.subtitleTracks || [];
                
                if (subs.length === 0) {
                    console.log('📝 Backend no devolvió subtítulos, leyendo del manifiesto HLS...');
                    
                    try {
                        const manifestUrl = `http://localhost:3001/hls/${videoId}/index.m3u8`;
                        const manifestResponse = await fetch(manifestUrl);
                        const manifestText = await manifestResponse.text();
                        
                        console.log('📝 Manifiesto HLS:', manifestText.substring(0, 500) + '...');
                        
                        const lines = manifestText.split('\n');
                        const subtitleLines = lines.filter(line => 
                            line.includes('TYPE=SUBTITLES') || line.includes('TYPE="SUBTITLES"')
                        );
                        
                        console.log(`📝 Encontradas ${subtitleLines.length} líneas de subtítulos en el manifiesto`);
                        
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
                                    uri: uriMatch[1]
                                });
                            }
                        });
                        
                        console.log(`📝 ${subs.length} subtítulos extraídos del manifiesto`);
                        
                    } catch (manifestError) {
                        console.error('❌ Error leyendo manifiesto HLS:', manifestError);
                    }
                }
                
                console.log(`🎵 ${response.data.audioTracks?.length || 0} pistas de audio`);
                console.log(`📝 ${subs.length} pistas de subtítulos`);
                
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
    }, [videoId]);

    return { audioTracks, subtitleTracks, isLoading, error };
};