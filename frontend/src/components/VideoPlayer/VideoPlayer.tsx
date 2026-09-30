import React, { useRef, useState, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import type { VideoPlayerProps, Quality, AudioTrack, SubtitleTrack } from './types';
import { usePlayerBackend } from './hooks/usePlayerBackend';
import { useVideoControls } from './hooks/useVideoControls';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useVideoInfo } from './hooks/useVideoInfo';
import { useSubtitles } from './hooks/useSubtitles';
import { useFullscreen } from './hooks/useFullscreen';
import { Controls } from './components/Controls';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ThumbnailPreview } from './components/ThumbnailPreview';
import { playerStyles, containerStyles } from './styles';
import type { FormatPreference } from './hooks/usePlayerBackend';

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  hlsUrl = null,
  dashUrl = null,
}) => {
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
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [formatPreference, setFormatPreference] = useState<FormatPreference>('auto');

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

  const { format, changeQuality, changeAudioTrack, hasDASH, hasHLS } = usePlayerBackend({
    videoId,
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    hlsUrl,
    dashUrl,
    formatPreference,
    hlsRef,
    onQualitiesLoaded: setQualities,
    onQualityChanged: (quality) => {
        setCurrentQuality(quality);
        setShowQualityMenu(false);
    },
    onLoadingChange: setIsLoading,
    onError: setError,
    onAudioTracksLoaded: (tracks) => {
        if (tracks && tracks.length > 0) {
            setAudioTracks(tracks);
            setCurrentAudioTrack(0);
        }
    },
    onSubtitleTracksLoaded: (tracks) => {
        if (tracks && tracks.length > 0) {
            setSubtitleTracks(tracks);
            setCurrentSubtitleTrack(0);
        }
    },
});

  useEffect(() => {
    console.log(`📺 [VideoPlayer] Using ${format} backend for ${videoId ?? 'no video'}`);
  }, [format, videoId]);

  useSubtitles(
    videoId,
    videoRef as React.RefObject<HTMLVideoElement>,
    subtitleTracks,
    currentSubtitleTrack,
    subtitlesEnabled
  );

  useEffect(() => {
    if (fetchedAudioTracks && fetchedAudioTracks.length > 0 && audioTracks.length === 0) {
      console.log('🎵 Using audio tracks from backend (fallback):', fetchedAudioTracks);
      setAudioTracks(fetchedAudioTracks);
      setCurrentAudioTrack(0);
      if (hlsRef.current && hlsRef.current.audioTrack !== undefined) {
        setTimeout(() => {
          if (hlsRef.current) {
            hlsRef.current.audioTrack = 0;
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
          tracks[i].mode = (!subtitlesEnabled) ? 'disabled' : (i === currentSubtitleTrack ? 'showing' : 'hidden');
        }
      }
    }
  }, [currentSubtitleTrack, subtitlesEnabled]);

  const handleAudioTrackChange = useCallback((trackIndex: number) => {
    changeAudioTrack(trackIndex);
    setCurrentAudioTrack(trackIndex);
  }, [changeAudioTrack]);

  const handleSubtitleTrackChange = useCallback((trackIndex: number) => {
    console.log(`📝 Changing to subtitle: ${trackIndex}`);
    setCurrentSubtitleTrack(trackIndex);
    setSubtitlesEnabled(true);
    if (videoRef.current) {
      const video = videoRef.current;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'subtitles') {
          tracks[i].mode = (i === trackIndex) ? 'showing' : 'hidden';
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
  }, [subtitlesEnabled]);

  const handleQualityChange = (level: number) => {
    changeQuality(level);
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

  const handleProgressMouseMove = useCallback((x: number, width: number) => {
    setMouseX(x);
    setProgressBarWidth(width);
  }, []);

  const handleProgressHover = useCallback((hovering: boolean) => {
    setIsHoveringProgress(hovering);
  }, []);

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

        {showControls && (
          <div
              style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  zIndex: 10,
                  transition: 'opacity 0.3s ease',
                  opacity: showControls ? 1 : 0,
                  pointerEvents: showControls ? 'auto' : 'none',
              }}
          >
              <select
                  value={formatPreference}
                  onChange={(e) => setFormatPreference(e.target.value as FormatPreference)}
                  style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: format === 'dash'
                          ? 'rgba(124,58,237,0.9)'
                          : format === 'hls'
                              ? 'rgba(59,130,246,0.9)'
                              : 'rgba(107,114,128,0.9)',
                      color: '#fff',
                      cursor: 'pointer',
                      outline: 'none',
                  }}
                  title="Player backend"
              >
                  <option value="auto">
                      Auto {format !== 'none' ? `(${format.toUpperCase()})` : ''}
                  </option>
                  <option value="dash" disabled={!hasDASH}>
                      DASH · ClearKey {hasDASH ? '' : '(unavailable)'}
                  </option>
                  <option value="hls" disabled={!hasHLS}>
                      HLS · AES-128 {hasHLS ? '' : '(unavailable)'}
                  </option>
              </select>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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
            subtitlesEnabled={subtitlesEnabled}
            onSubtitlesToggle={handleSubtitlesToggle}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={handleSpeedChange}
            onProgressMouseMove={handleProgressMouseMove}
            onProgressHover={handleProgressHover}
          />

          <ThumbnailPreview
            videoId={videoId}
            duration={duration}
            containerWidth={progressBarWidth}
            mouseX={mouseX}
            visible={isHoveringProgress}
          />
        </div>

        <LoadingOverlay isLoading={isLoading} error={error} onRetry={handleRetry} />
      </div>
    </>
  );
};