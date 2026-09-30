import { useEffect, useRef, useState, useCallback } from 'react';
import * as dashjs from 'dashjs';
import type { Quality, AudioTrack, SubtitleTrack } from '../types';

interface DashRepresentation {
    id: string;
    bitrateInKbit?: number;
    width?: number;
    height?: number;
    codec?: string;
}

interface DashTrack {
    lang?: string;
    codec?: string;
    index?: number;
    labels?: Array<{ text: string }>;
}

declare module 'dashjs' {
    interface MediaPlayerClass {
        getRepresentationsByType(type: string): DashRepresentation[];
        setRepresentationForTypeByIndex(type: string, index: number, forceReplace?: boolean): void;
        getCurrentRepresentationForType(type: string): DashRepresentation | null;
        getTracksFor(mediaType: string): DashTrack[];
        setCurrentTrack(track: DashTrack): void;
    }
}


interface RuntimeQualityChangeEvent {
    mediaType: string;
    oldQuality?: number;
    newQuality: number;
    streamId?: string;
}

interface RuntimeErrorEvent {
    error?: string | { code?: number; message?: string; data?: object };
}


interface UseDASHProps {
    videoId: string | null;
    mpdUrl: string | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    enabled: boolean;
    onQualitiesLoaded: (qualities: Quality[]) => void;
    onQualityChanged: (quality: string) => void;
    onLoadingChange: (loading: boolean) => void;
    onError: (error: string | null) => void;
    onAudioTracksLoaded?: (tracks: AudioTrack[]) => void;
    onSubtitleTracksLoaded?: (tracks: SubtitleTrack[]) => void;
}

const LICENSE_SERVICE_URL = 'http://localhost:4000/api/license';


export const useDASH = ({
    videoId,
    mpdUrl,
    videoRef,
    enabled,
    onQualitiesLoaded,
    onQualityChanged,
    onLoadingChange,
    onError,
    onAudioTracksLoaded,
    onSubtitleTracksLoaded,
}: UseDASHProps) => {
    const playerRef = useRef<dashjs.MediaPlayerClass | null>(null);
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

    const changeQuality = useCallback((level: number) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            if (level === -1) {
                player.updateSettings({
                    streaming: { abr: { autoSwitchBitrate: { video: true } } },
                });
                onQualityChangedRef.current('auto');
                console.log('[useDASH] Quality → auto');
            } else {
                player.updateSettings({
                    streaming: { abr: { autoSwitchBitrate: { video: false } } },
                });

                const reps = player.getRepresentationsByType('video');
                const rep = reps[level];
                if (rep) {
                    player.setRepresentationForTypeByIndex('video', level, true);

                    // Emitir el cambio manualmente para que la UI lo refleje.
                    // DASH v5 no dispara QUALITY_CHANGE_RENDERED en switches manuales.
                    const name = rep.height
                        ? `${rep.height}p`
                        : `${rep.bitrateInKbit ?? 0}kbps`;
                    onQualityChangedRef.current(name);
                    console.log(`[useDASH] Quality → index ${level} (${name})`);
                } else {
                    console.warn('[useDASH] Representation not found:', level);
                }
            }
            setCurrentLevel(level);
        } catch (err) {
            console.warn('[useDASH] changeQuality error:', err);
        }
    }, []);

    const changeAudioTrack = useCallback((trackIndex: number) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            const tracks = player.getTracksFor('audio');
            console.log('[useDASH] Available audio tracks:',
                tracks.map((t, i) => ({ i, lang: t.lang, codec: t.codec })));

            const track = tracks[trackIndex];
            if (track) {
                player.setCurrentTrack(track);
                console.log(`[useDASH] Audio track → ${trackIndex}`);
            } else {
                console.warn('[useDASH] Audio track not found:', trackIndex);
            }
        } catch (err) {
            console.warn('[useDASH] changeAudioTrack error:', err);
        }
    }, []);

    const changeSubtitleTrack = useCallback((trackIndex: number) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            const tracks = player.getTracksFor('text');
            const track = tracks[trackIndex];
            if (track) {
                player.setCurrentTrack(track);
                console.log(`[useDASH] Subtitle track → ${trackIndex}`);
            }
        } catch (err) {
            console.warn('[useDASH] changeSubtitleTrack error:', err);
        }
    }, []);

    const cleanup = useCallback(() => {
        if (playerRef.current) {
            try { playerRef.current.reset(); } catch { }
            playerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            cleanup();
            return;
        }

        if (!videoRef.current || !mpdUrl || !videoId) {
            cleanup();
            return;
        }

        const video = videoRef.current;
        console.log('🎬 [useDASH] Loading DASH stream:', mpdUrl);
        onLoadingChangeRef.current(true);
        onErrorRef.current(null);

        cleanup();

        const player = dashjs.MediaPlayer().create();
        playerRef.current = player;

        player.setProtectionData({
            'org.w3.clearkey': {
                serverURL: LICENSE_SERVICE_URL,
                httpRequestHeaders: {},
                priority: 0,
            },
        });

        player.updateSettings({
            streaming: {
                abr: {
                    autoSwitchBitrate: { video: true, audio: true },
                    initialBitrate: { video: -1, audio: -1 },
                },
                buffer: {
                    fastSwitchEnabled: true,
                },
            },
        });

        player.initialize(video, mpdUrl, true);

        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            console.log('✅ [useDASH] Stream initialized');
            onLoadingChangeRef.current(false);

            const reps = player.getRepresentationsByType('video');
            const qualities: Quality[] = reps
                .map((r, index) => ({
                    height: r.height ?? 0,
                    name: r.height ? `${r.height}p` : `${r.bitrateInKbit ?? 0}kbps`,
                    level: index,
                    bitrate: r.bitrateInKbit ? r.bitrateInKbit * 1000 : undefined,
                }))
                .filter((q) => q.height > 0)
                .sort((a, b) => a.height - b.height);

            onQualitiesLoadedRef.current(qualities);

            const audioTracks = player.getTracksFor('audio');
            if (audioTracks.length > 0) {
                const mapped: AudioTrack[] = audioTracks.map((t, index) => ({
                    index,
                    language: t.lang ?? t.labels?.[0]?.text ?? `Track ${index + 1}`,
                    codec: t.codec ?? 'aac',
                    channels: 2,
                    sampleRate: 44100,
                    title: t.labels?.[0]?.text ?? `Audio ${index + 1}`,
                }));
                onAudioTracksLoadedRef.current?.(mapped);
            }

            const textTracks = player.getTracksFor('text');
            if (textTracks.length > 0) {
                const mapped: SubtitleTrack[] = textTracks.map((t, index) => ({
                    index,
                    language: t.lang ?? `sub${index}`,
                    codec: t.codec ?? 'vtt',
                    title: t.labels?.[0]?.text ?? `Subtitle ${index + 1}`,
                    default: index === 0,
                }));
                onSubtitleTracksLoadedRef.current?.(mapped);
            }
        });

        player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
            const evt = e as unknown as RuntimeQualityChangeEvent;
            if (evt.mediaType !== 'video') return;

            const reps = player.getRepresentationsByType('video');
            const rep = reps[evt.newQuality];
            if (rep) {
                const name = rep.height
                    ? `${rep.height}p`
                    : `${rep.bitrateInKbit ?? 0}kbps`;
                onQualityChangedRef.current(name);
            }
        });

        player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
            console.error('❌ [useDASH] Error:', e);
            const evt = e as unknown as RuntimeErrorEvent;
            let message = 'DASH playback error';
            if (typeof evt.error === 'string') {
                message = evt.error;
            } else if (evt.error && typeof evt.error === 'object' && 'message' in evt.error) {
                message = evt.error.message ?? message;
            }
            onErrorRef.current(message);
            onLoadingChangeRef.current(false);
        });

        return () => {
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, videoId, mpdUrl]);

    return {
        changeQuality,
        changeAudioTrack,
        changeSubtitleTrack,
        currentLevel,
        playerRef,
    };
};