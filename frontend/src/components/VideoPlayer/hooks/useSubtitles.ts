import { useEffect, useRef } from 'react';
import type { SubtitleTrack } from '../types';

function parseVTT(vttText: string): { start: number; end: number; text: string }[] {
    const lines = vttText.split('\n');
    const cues: { start: number; end: number; text: string }[] = [];
    let currentCue: { start: number; end: number; text: string } | null = null;
    let textLines: string[] = [];

    for (const line of lines) {
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/);
        
        if (timeMatch) {
            if (currentCue && textLines.length > 0) {
                currentCue.text = textLines.join('\n').trim();
                cues.push(currentCue);
            }
            
            const start = parseTime(timeMatch[1]);
            const end = parseTime(timeMatch[2]);
            currentCue = { start, end, text: '' };
            textLines = [];
        } else if (currentCue && line.trim() && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !line.startsWith('#')) {
            textLines.push(line.trim());
        }
    }

    if (currentCue && textLines.length > 0) {
        currentCue.text = textLines.join('\n').trim();
        cues.push(currentCue);
    }

    return cues;
}

function parseTime(timeStr: string): number {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseFloat(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
    }
    return 0;
}

export const useSubtitles = (
    videoId: string | null,
    videoRef: React.RefObject<HTMLVideoElement>,
    subtitleTracks: SubtitleTrack[],
    currentSubtitleTrack: number,
    subtitlesEnabled: boolean
) => {
    const cuesMapRef = useRef<Map<number, { start: number; end: number; text: string }[]>>(new Map());
    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (!videoRef.current || !videoId) return;
        if (subtitleTracks.length === 0) return;

        const video = videoRef.current;
        const baseUrl = `http://localhost:3001/hls/${videoId}`;

        console.log(`📝 Cargando ${subtitleTracks.length} subtítulos...`);

        const oldTracks = video.querySelectorAll('track');
        oldTracks.forEach(el => el.remove());

        // disable text tracks
        for (let i = 0; i < video.textTracks.length; i++) {
            if (video.textTracks[i].kind === 'subtitles') {
                video.textTracks[i].mode = 'disabled';
            }
        }

        cuesMapRef.current.clear();
        isInitializedRef.current = false;

        // create tracks and load vtt
        subtitleTracks.forEach((track, index) => {
            const vttUrl = `${baseUrl}/subtitle_${index}.vtt`;
            const trackEl = document.createElement('track');
            trackEl.kind = 'subtitles';
            trackEl.label = track.language || `Subtitle ${index + 1}`;
            trackEl.srclang = track.language || 'en';
            trackEl.src = vttUrl;
            trackEl.default = index === 0;
            video.appendChild(trackEl);
            
            fetch(vttUrl)
                .then(res => res.text())
                .then(vttText => {
                    const cues = parseVTT(vttText);
                    cuesMapRef.current.set(index, cues);
                    
                    if (trackEl.track) {
                        while (trackEl.track.cues && trackEl.track.cues.length > 0) {
                            trackEl.track.removeCue(trackEl.track.cues[0]);
                        }
                        
                        cues.forEach(cue => {
                            const textTrackCue = new VTTCue(cue.start, cue.end, cue.text);
                            trackEl.track.addCue(textTrackCue);
                        });
                        console.log(`✅ ${cues.length} cues agregados al track ${index} (${track.language})`);
                    }

                    if (cuesMapRef.current.size === subtitleTracks.length && !isInitializedRef.current) {
                        isInitializedRef.current = true;
                        setTimeout(() => {
                            applySubtitles(video);
                        }, 100);
                    }
                })
                .catch(err => {
                    console.error(`❌ Error cargando VTT ${index}:`, err);
                });
        });

        const applySubtitles = (videoElement: HTMLVideoElement) => {
            const tracks = videoElement.textTracks;
            console.log(`📝 Aplicando track ${currentSubtitleTrack} (enabled: ${subtitlesEnabled})`);
            
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (track.kind === 'subtitles') {
                    const cues = cuesMapRef.current.get(i);
                    
                    if (!subtitlesEnabled) {
                        track.mode = 'disabled';
                        console.log(`⏹️ Track ${i} desactivado`);
                        continue;
                    }
                    
                    if (i === currentSubtitleTrack && cues && cues.length > 0) {
                        track.mode = 'showing';
                        console.log(`✅ Track ${i} mostrando (${cues.length} cues)`);
                    } else {
                        track.mode = 'hidden';
                    }
                }
            }
        };

        const timeoutId = setTimeout(() => {
            if (video) {
                applySubtitles(video);
            }
        }, 500);

        video.addEventListener('loadeddata', () => {
            if (video) applySubtitles(video);
        });

        return () => {
            clearTimeout(timeoutId);
            video.removeEventListener('loadeddata', () => {});
            const tracks = video.querySelectorAll('track');
            tracks.forEach(el => el.remove());
            cuesMapRef.current.clear();
            isInitializedRef.current = false;
        };
    }, [videoId, subtitleTracks, currentSubtitleTrack, subtitlesEnabled, videoRef]); 
};