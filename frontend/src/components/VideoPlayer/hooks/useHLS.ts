// frontend/src/hooks/useHLS.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import type { Quality, AudioTrack, SubtitleTrack } from '../types';

interface UseHLSProps {
    videoId: string | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    onQualitiesLoaded: (qualities: Quality[]) => void;
    onQualityChanged: (quality: string) => void;
    onLoadingChange: (loading: boolean) => void;
    onError: (error: string | null) => void;
    onAudioTracksLoaded?: (tracks: AudioTrack[]) => void;
    onSubtitleTracksLoaded?: (tracks: SubtitleTrack[]) => void;
    hlsRef?: React.MutableRefObject<Hls | null>;
}

export const useHLS = ({
    videoId,
    videoRef,
    onQualitiesLoaded,
    onQualityChanged,
    onLoadingChange,
    onError,
    onAudioTracksLoaded,
    onSubtitleTracksLoaded,
    hlsRef: externalHlsRef,
}: UseHLSProps) => {
    const internalHlsRef = useRef<Hls | null>(null);
    const hlsRef = externalHlsRef || internalHlsRef;

    const [currentLevel, setCurrentLevel] = useState<number>(-1);

    const onQualitiesLoadedRef = useRef(onQualitiesLoaded);
    const onQualityChangedRef = useRef(onQualityChanged);
    const onLoadingChangeRef = useRef(onLoadingChange);
    const onErrorRef = useRef(onError);
    const onAudioTracksLoadedRef = useRef(onAudioTracksLoaded);
    const onSubtitleTracksLoadedRef = useRef(onSubtitleTracksLoaded);

    useEffect(() => {
        onQualitiesLoadedRef.current = onQualitiesLoaded;
        onQualityChangedRef.current = onQualityChanged;
        onLoadingChangeRef.current = onLoadingChange;
        onErrorRef.current = onError;
        onAudioTracksLoadedRef.current = onAudioTracksLoaded;
        onSubtitleTracksLoadedRef.current = onSubtitleTracksLoaded;
    });

    const changeQuality = useCallback(
        (level: number) => {
            if (!hlsRef.current) return;
            hlsRef.current.currentLevel = level;
            setCurrentLevel(level);
        },
        [hlsRef]
    );

    const cleanup = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, [hlsRef]);

    useEffect(() => {
        if (!videoRef.current || !videoId) {
            cleanup();
            return;
        }

        const video = videoRef.current;
        const streamUrl = `http://localhost:3001/hls/${videoId}/index.m3u8`;

        console.log('🎬 Loading stream:', streamUrl);
        onLoadingChangeRef.current(true);
        onErrorRef.current(null);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                abrEwmaDefaultEstimate: 500000,
                abrEwmaFastLive: 3,
                abrEwmaSlowLive: 9,
                abrBandWidthFactor: 0.8,
                abrBandWidthUpFactor: 0.7,
                startLevel: -1,
            });

            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            const parseAndGroupQualities = (levels: any[]): Quality[] => {
                const grouped = new Map<
                    number,
                    { level: number; height: number; bitrate: number; codec?: string }
                >();

                levels.forEach((level, index) => {
                    let height = level.height || 0;
                    if (!height && level.name) {
                        const match = level.name.match(/(\d+)p/);
                        if (match) height = parseInt(match[1]);
                    }
                    if (!height && level.bitrate) {
                        const bitrate = level.bitrate;
                        if (bitrate <= 200000) height = 144;
                        else if (bitrate <= 400000) height = 240;
                        else if (bitrate <= 800000) height = 360;
                        else if (bitrate <= 1500000) height = 480;
                        else if (bitrate <= 3000000) height = 720;
                        else if (bitrate <= 6000000) height = 1080;
                        else if (bitrate <= 10000000) height = 1440;
                        else height = 2160;
                    }

                    if (height === 0) return;

                    const existing = grouped.get(height);
                    if (!existing || level.bitrate < existing.bitrate) {
                        grouped.set(height, {
                            level: index,
                            height,
                            bitrate: level.bitrate,
                            codec: level.codec,
                        });
                    }
                });

                return Array.from(grouped.values())
                    .sort((a, b) => a.height - b.height)
                    .map(({ level, height, bitrate }) => ({
                        height,
                        name: `${height}p`,
                        level, 
                        bitrate,
                    }));
            };

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('📋 Manifest parsed');
                const qualities = parseAndGroupQualities(hls.levels);
                console.log('📊 Unique qualities (grouped):', qualities);
                onQualitiesLoadedRef.current(qualities);
                onLoadingChangeRef.current(false);

                console.log('🔍 Audio tracks in HLS:', hls.audioTracks);

                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    const audioTracks: AudioTrack[] = hls.audioTracks.map(
                        (track: any, index: number) => ({
                            index: index,
                            language: track.name || track.lang || `Track ${index + 1}`,
                            codec: 'aac',
                            channels: 2,
                            sampleRate: 44100,
                            title: track.name || `Audio ${index + 1}`,
                        })
                    );
                    console.log('🎵 Audio tracks detected:', audioTracks);
                    onAudioTracksLoadedRef.current?.(audioTracks);

                    const preferredIndex = 0;
                    console.log(
                        `🎵 Selecting audio track ${preferredIndex} (${audioTracks[preferredIndex]?.language})`
                    );

                    if (hls.audioTrack !== undefined) {
                        hls.audioTrack = preferredIndex;
                        console.log(`✅ HLS audio track forced to: ${preferredIndex}`);
                    }
                } else {
                    console.warn('⚠️ No audio tracks detected in HLS, forcing track 0');
                    if (hls.audioTrack !== undefined) {
                        hls.audioTrack = 0;
                        console.log('✅ HLS audio track forced to: 0');
                    }
                }

                video
                    .play()
                    .then(() => console.log('▶️ Playback started'))
                    .catch((err) => console.log('⏸️ Autoplay blocked:', err));
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
                console.log('🎵 Audio tracks updated:', data);
                if (data.audioTracks && data.audioTracks.length > 0) {
                    const audioTracks: AudioTrack[] = data.audioTracks.map(
                        (track: any, index: number) => ({
                            index: index,
                            language: track.name || track.lang || `Track ${index + 1}`,
                            codec: 'aac',
                            channels: 2,
                            sampleRate: 44100,
                            title: track.name || `Audio ${index + 1}`,
                        })
                    );
                    onAudioTracksLoadedRef.current?.(audioTracks);

                    if (hlsRef.current && hlsRef.current.audioTrack !== undefined) {
                        hlsRef.current.audioTrack = 0;
                        console.log(
                            '✅ HLS audio track forced to: 0 (from AUDIO_TRACKS_UPDATED)'
                        );
                    }
                }
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
                console.log('🎵 Audio track switched to:', data.id);
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                const level = hls.levels[data.level];
                if (level) {
                    let height = level.height || 0;
                    let name = '';

                    if (!height && level.name) {
                        const match = level.name.match(/(\d+)p/);
                        if (match) {
                            height = parseInt(match[1]);
                        }
                    }

                    if (height) {
                        name = `${height}p`;
                    } else {
                        name = `${Math.round(level.bitrate / 1000)}kbps`;
                    }

                    console.log(`📊 Switched to quality: ${name}`);
                    onQualityChangedRef.current(name);
                }
            });

            hls.on(Hls.Events.LEVELS_UPDATED, (_event, data) => {
                console.log('🔄 Levels updated:', data.levels.length);
                const qualities = parseAndGroupQualities(data.levels);
                onQualitiesLoadedRef.current(qualities);
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                console.error('❌ HLS Error:', data);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('🔄 Network error, retrying...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('🔄 Media error, recovering...');
                            hls.recoverMediaError();
                            break;
                        default:
                            onErrorRef.current(
                                'Fatal error loading video. Please try again.'
                            );
                            onLoadingChangeRef.current(false);
                            break;
                    }
                }
            });

            return cleanup;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('🍎 Using Safari native HLS');
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                onLoadingChangeRef.current(false);
                video
                    .play()
                    .then(() => console.log('▶️ Playback started (Safari)'))
                    .catch(() => console.log('⏸️ Autoplay blocked (Safari)'));
            });
        } else {
            onErrorRef.current('❌ HLS not supported in this browser');
            onLoadingChangeRef.current(false);
        }

        return cleanup;
    }, [videoId, hlsRef, cleanup]);

    return { changeQuality, currentLevel, hlsRef };
};