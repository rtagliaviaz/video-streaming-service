import React, { useRef, useState, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import type { VideoPlayerProps, Quality, AudioTrack, SubtitleTrack } from './types';
import { useHLS } from './hooks/useHLS';
import { useVideoControls } from './hooks/useVideoControls';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useVideoInfo } from './hooks/useVideoInfo';
import { useSubtitles } from './hooks/useSubtitles';
import { useFullscreen } from './hooks/useFullscreen';
import { Controls } from './components/Controls';
import { LoadingOverlay } from './components/LoadingOverlay';
import { playerStyles, containerStyles } from './styles';

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
    const [qualities, setQualities] = useState<Quality[]>([]);
    const [currentQuality, setCurrentQuality] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
    const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(0);
    const [showControls, setShowControls] = useState(true);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);

    const { audioTracks: fetchedAudioTracks, subtitleTracks: fetchedSubtitleTracks } = useVideoInfo(videoId);
    const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef as React.RefObject<HTMLDivElement>);
    
    const {
        isPlaying,
        isMuted,
        volume,
        currentTime,
        duration,
        bufferedProgress,
        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleSeek,
        showControlsTemporarily,
        handlePlay,
        handlePause,
        handleTimeUpdate,
        handleLoadedMetadata,
        handleVolumeChangeEvent,
        handleProgress,
        formatTime,
        cleanup: cleanupControls,
    } = useVideoControls(videoRef as React.RefObject<HTMLVideoElement>);

    const { changeQuality } = useHLS({
        videoId,
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
        onQualitiesLoaded: setQualities,
        onQualityChanged: (quality) => {
            setCurrentQuality(quality);
            setShowQualityMenu(false);
        },
        onLoadingChange: setIsLoading,
        onError: setError,
        onAudioTracksLoaded: (tracks) => {
            console.log('🎵 Audio tracks loaded from HLS:', tracks);
            if (tracks && tracks.length > 0) {
                setAudioTracks(tracks);

                setCurrentAudioTrack(0);

                if (hlsRef.current && hlsRef.current.audioTrack !== undefined) {
                    setTimeout(() => {
                        if (hlsRef.current) {
                            hlsRef.current.audioTrack = 0;
                            console.log('✅ HLS audio track forzado a: 0');
                        }
                    }, 300);
                }
            }
        },
        onSubtitleTracksLoaded: (tracks) => {
            if (tracks && tracks.length > 0) {
                setSubtitleTracks(tracks);
                if (tracks.length > 0) setCurrentSubtitleTrack(0);
            }
        },
        hlsRef,
    });

    useSubtitles(
        videoId,
        videoRef as React.RefObject<HTMLVideoElement>,
        subtitleTracks,
        currentSubtitleTrack,
        subtitlesEnabled
    );

    useEffect(() => {
        if (fetchedAudioTracks && fetchedAudioTracks.length > 0 && audioTracks.length === 0) {
            console.log('🎵 Usando audio tracks del backend (fallback):', fetchedAudioTracks);
            setAudioTracks(fetchedAudioTracks);
            
            setCurrentAudioTrack(0);
            
            if (hlsRef.current && hlsRef.current.audioTrack !== undefined) {
                setTimeout(() => {
                    if (hlsRef.current) {
                        hlsRef.current.audioTrack = 0;
                        console.log('✅ HLS audio track forzado a: 0 (desde backup)');
                    }
                }, 500);
            }
        }
    }, [fetchedAudioTracks, audioTracks.length]);

    useEffect(() => {
        if (fetchedSubtitleTracks?.length > 0 && subtitleTracks.length === 0) {
            setSubtitleTracks(fetchedSubtitleTracks);
            if (fetchedSubtitleTracks.length > 0) setCurrentSubtitleTrack(0);
        }
    }, [fetchedSubtitleTracks, subtitleTracks.length]);

    useEffect(() => {
        if (videoRef.current && subtitleTracks.length > 0) {
            const video = videoRef.current;
            const tracks = video.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].kind === 'subtitles') {
                    if (!subtitlesEnabled) {
                        tracks[i].mode = 'disabled';
                    } else {
                        tracks[i].mode = i === currentSubtitleTrack ? 'showing' : 'hidden';
                    }
                }
            }
            console.log(`📝 Forzado cambio a track ${currentSubtitleTrack} (enabled: ${subtitlesEnabled})`);
        }
    }, [currentSubtitleTrack, subtitlesEnabled]);


    const handleAudioTrackChange = useCallback((trackIndex: number) => {
        if (!hlsRef.current) return;
        if (hlsRef.current.audioTrack !== undefined) {
            hlsRef.current.audioTrack = trackIndex;
            setCurrentAudioTrack(trackIndex);
            console.log(`🎵 Audio track cambiado a: ${trackIndex}`);
        }
    }, []);

    const handleSubtitleTrackChange = useCallback((trackIndex: number) => {
        console.log(`📝 Cambiando a subtítulo: ${trackIndex}`);
        setCurrentSubtitleTrack(trackIndex);
        setSubtitlesEnabled(true);
        
        if (videoRef.current) {
            const video = videoRef.current;
            const tracks = video.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].kind === 'subtitles') {
                    tracks[i].mode = i === trackIndex ? 'showing' : 'hidden';
                }
            }
        }
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
    }, []);

    const handleSubtitlesToggle = useCallback(() => {
        setSubtitlesEnabled(!subtitlesEnabled);
        console.log(`📝 Subtítulos ${!subtitlesEnabled ? 'activados' : 'desactivados'}`);
    }, [subtitlesEnabled]);

    const handleQualityChange = (level: number) => {
        changeQuality(level);
        if (level === -1) setCurrentQuality('auto');
    };

    const handleRetry = () => {
        setError(null);
        if (videoId) {
            const video = videoRef.current;
            if (video) video.load();
        }
    };

    useKeyboardShortcuts({
        togglePlay,
        toggleFullscreen,
        toggleMute,
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    });

    // al cambiar videoId, limpiar subtítulos si el nuevo video no tiene
    useEffect(() => {
        setSubtitleTracks([]);
        setCurrentSubtitleTrack(0);
        setSubtitlesEnabled(false);
    }, [videoId]);


    useEffect(() => {
        if (fetchedSubtitleTracks && fetchedSubtitleTracks.length > 0) {
            setSubtitleTracks(fetchedSubtitleTracks);
            if (fetchedSubtitleTracks.length > 0) setCurrentSubtitleTrack(0);
        } else {
            setSubtitleTracks([]);
            setCurrentSubtitleTrack(0);
            setSubtitlesEnabled(false);
        }
    }, [fetchedSubtitleTracks]);


    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoId) return;

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('volumechange', handleVolumeChangeEvent);
        video.addEventListener('progress', handleProgress);

        const handleMouseMove = () => showControlsTemporarily();
        containerRef.current?.addEventListener('mousemove', handleMouseMove);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('volumechange', handleVolumeChangeEvent);
            video.removeEventListener('progress', handleProgress);
            containerRef.current?.removeEventListener('mousemove', handleMouseMove);
        };
    }, [videoId, handlePlay, handlePause, handleTimeUpdate, handleLoadedMetadata, handleVolumeChangeEvent, handleProgress, showControlsTemporarily]);


    useEffect(() => {
        return () => cleanupControls();
    }, [cleanupControls]);

    if (!videoId) {
        return (
            <div style={containerStyles.emptyState}>
                <style dangerouslySetInnerHTML={{ __html: playerStyles }} />
                <div style={containerStyles.emptyIcon}>🎬</div>
                <p style={containerStyles.emptyTitle}>No video selected</p>
                <p style={containerStyles.emptySubtitle}>Upload a video or select one from the list</p>
            </div>
        );
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: playerStyles }} />
            <div
                ref={containerRef}
                className="video-container"
                style={containerStyles.container}
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
            >
                <video
                    ref={videoRef}
                    onClick={togglePlay}
                    playsInline
                    style={containerStyles.video}
                    poster={`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="%231a1a2e"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="%23666" text-anchor="middle">Loading...</text></svg>`}
                />

                <Controls
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    volume={volume}
                    currentTime={currentTime}
                    duration={duration}
                    bufferedProgress={bufferedProgress}
                    showControls={showControls}
                    qualities={qualities}
                    currentQuality={currentQuality}
                    showQualityMenu={showQualityMenu}
                    onQualityMenuToggle={() => setShowQualityMenu(!showQualityMenu)}
                    onQualityChange={handleQualityChange}
                    audioTracks={audioTracks}
                    currentAudioTrack={currentAudioTrack}
                    onAudioTrackChange={handleAudioTrackChange}
                    subtitleTracks={subtitleTracks}
                    currentSubtitleTrack={currentSubtitleTrack}
                    onSubtitleTrackChange={handleSubtitleTrackChange}
                    onTogglePlay={togglePlay}
                    onToggleMute={toggleMute}
                    onVolumeChange={handleVolumeChange}
                    onSeek={handleSeek}
                    onToggleFullscreen={toggleFullscreen}
                    formatTime={formatTime}
                    isFullscreen={isFullscreen}
                    videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                    subtitlesEnabled={subtitlesEnabled}
                    onSubtitlesToggle={handleSubtitlesToggle}
                    playbackSpeed={playbackSpeed}
                    onPlaybackSpeedChange={handleSpeedChange}
                />

                <LoadingOverlay isLoading={isLoading} error={error} onRetry={handleRetry} />
            </div>
        </>
    );
};