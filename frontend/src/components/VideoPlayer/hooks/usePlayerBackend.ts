import { useEffect, useState } from 'react';
import { useHLS } from './useHLS';
import { useDASH } from './useDASH';
import type { Quality, AudioTrack, SubtitleTrack } from '../types';
import type Hls from 'hls.js';

export type FormatPreference = 'auto' | 'hls' | 'dash';
export type PlayerFormat = 'hls' | 'dash' | 'none';

interface UsePlayerBackendProps {
    videoId: string | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    hlsUrl: string | null;
    dashUrl: string | null;
    formatPreference?: FormatPreference;
    hlsRef: React.MutableRefObject<Hls | null>;
    onQualitiesLoaded: (qualities: Quality[]) => void;
    onQualityChanged: (quality: string) => void;
    onLoadingChange: (loading: boolean) => void;
    onError: (error: string | null) => void;
    onAudioTracksLoaded: (tracks: AudioTrack[]) => void;
    onSubtitleTracksLoaded: (tracks: SubtitleTrack[]) => void;
}

async function supportsClearKeyEME(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('requestMediaKeySystemAccess' in navigator)) {
        return false;
    }
    try {
        await navigator.requestMediaKeySystemAccess('org.w3.clearkey', [{
            initDataTypes: ['keyids'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.64001f"' }],
        }]);
        return true;
    } catch {
        return false;
    }
}

export const usePlayerBackend = (props: UsePlayerBackendProps) => {
    const { formatPreference = 'auto' } = props;
    const [format, setFormat] = useState<PlayerFormat>('none');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!props.videoId) {
                if (!cancelled) setFormat('none');
                return;
            }

            if (formatPreference === 'hls') {
                if (!cancelled) setFormat(props.hlsUrl ? 'hls' : 'none');
                return;
            }

            if (formatPreference === 'dash') {
                if (!cancelled) setFormat(props.dashUrl ? 'dash' : 'none');
                return;
            }

            // Auto: DASH si soporta EME, si no HLS
            if (props.dashUrl && await supportsClearKeyEME()) {
                if (!cancelled) {
                    console.log('🎯 [playerBackend] Using DASH (ClearKey + EME)');
                    setFormat('dash');
                }
                return;
            }

            if (props.hlsUrl) {
                if (!cancelled) {
                    console.log('🎯 [playerBackend] Using HLS (AES-128)');
                    setFormat('hls');
                }
                return;
            }

            if (!cancelled) setFormat('none');
        })();

        return () => { cancelled = true; };
    }, [props.videoId, props.hlsUrl, props.dashUrl, formatPreference]);

    const hls = useHLS({
        videoId: props.videoId,
        videoRef: props.videoRef,
        enabled: format === 'hls',
        streamUrl: props.hlsUrl,
        onQualitiesLoaded: props.onQualitiesLoaded,
        onQualityChanged: props.onQualityChanged,
        onLoadingChange: props.onLoadingChange,
        onError: props.onError,
        onAudioTracksLoaded: props.onAudioTracksLoaded,
        onSubtitleTracksLoaded: props.onSubtitleTracksLoaded,
        hlsRef: props.hlsRef,
    });

    const dash = useDASH({
        videoId: props.videoId,
        mpdUrl: props.dashUrl,
        videoRef: props.videoRef,
        enabled: format === 'dash',
        onQualitiesLoaded: props.onQualitiesLoaded,
        onQualityChanged: props.onQualityChanged,
        onLoadingChange: props.onLoadingChange,
        onError: props.onError,
        onAudioTracksLoaded: props.onAudioTracksLoaded,
        onSubtitleTracksLoaded: props.onSubtitleTracksLoaded,
    });

    return {
        format,
        changeQuality: format === 'dash' ? dash.changeQuality : hls.changeQuality,
        changeAudioTrack: format === 'dash' ? dash.changeAudioTrack : hls.changeAudioTrack,
        changeSubtitleTrack: format === 'dash' ? dash.changeSubtitleTrack : () => {
            // HLS usa <track> nativos, se maneja en VideoPlayer con textTracks
        },
        currentLevel: format === 'dash' ? dash.currentLevel : hls.currentLevel,
        hasDASH: !!props.dashUrl,
        hasHLS: !!props.hlsUrl,
    };
};