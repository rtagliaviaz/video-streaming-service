import React, { useRef } from 'react';
import { ProgressBar } from '../ProgressBar';
import { QualitySelector } from '../QualitySelector';
import { PlayButton } from './PlayButton';
import { VolumeControl } from './VolumeControl';
import { TimeDisplay } from './TimeDisplay';
import { SubtitleSelector } from './SubtitleSelector';
import { AudioSelector } from './AudioSelector';
import { SpeedSelector } from './SpeedSelector';
import { FullscreenButton } from './FullscreenButton';
import type { Quality, AudioTrack, SubtitleTrack } from '../../types';

interface ControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  bufferedProgress: number;
  showControls: boolean;
  qualities: Quality[];
  currentQuality: string;
  showQualityMenu: boolean;
  onQualityMenuToggle: () => void;
  onQualityChange: (level: number) => void;
  audioTracks: AudioTrack[];
  currentAudioTrack: number;
  onAudioTrackChange: (trackIndex: number) => void;
  subtitleTracks: SubtitleTrack[];
  currentSubtitleTrack: number;
  onSubtitleTrackChange: (trackIndex: number) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleFullscreen: () => void;
  formatTime: (seconds: number) => string;
  isFullscreen: boolean;
  subtitlesEnabled: boolean;
  onSubtitlesToggle: () => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  onProgressMouseMove?: (mouseX: number, containerWidth: number) => void;
  onProgressHover?: (isHovering: boolean) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  bufferedProgress,
  showControls,
  qualities,
  currentQuality,
  showQualityMenu,
  onQualityMenuToggle,
  onQualityChange,
  audioTracks,
  currentAudioTrack,
  onAudioTrackChange,
  subtitleTracks,
  currentSubtitleTrack,
  onSubtitleTrackChange,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onSeek,
  onToggleFullscreen,
  formatTime,
  isFullscreen,
  subtitlesEnabled,
  onSubtitlesToggle,
  playbackSpeed,
  onPlaybackSpeedChange,
  onProgressMouseMove,
  onProgressHover,
}) => {
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    if (onProgressMouseMove) {
      onProgressMouseMove(clampedX, rect.width);
    }
  };

  const handleMouseEnter = () => onProgressHover?.(true);
  const handleMouseLeave = () => onProgressHover?.(false);

  const styles = {
    overlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      padding: '1rem 1rem 0.75rem',
      background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
      transition: 'opacity 0.3s ease',
      opacity: showControls ? 1 : 0,
      pointerEvents: showControls ? ('auto' as const) : ('none' as const),
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: 'white',
      flexWrap: 'wrap' as const,
      marginTop: '0.5rem',
    },
    spacer: { flex: 1 },
  };

  return (
    <div style={styles.overlay}>
      <div
        ref={progressContainerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', position: 'relative' }}
      >
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          bufferedProgress={bufferedProgress}
          onSeek={onSeek}
        />
      </div>

      <div style={styles.row}>
        <PlayButton isPlaying={isPlaying} onToggle={onTogglePlay} />
        <VolumeControl
          isMuted={isMuted}
          volume={volume}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
        />
        <TimeDisplay currentTime={currentTime} duration={duration} formatTime={formatTime} />
        <div style={styles.spacer} />
        <SubtitleSelector
          subtitleTracks={subtitleTracks}
          currentSubtitleTrack={currentSubtitleTrack}
          subtitlesEnabled={subtitlesEnabled}
          onToggle={onSubtitlesToggle}
          onChange={onSubtitleTrackChange}
        />
        <AudioSelector
          audioTracks={audioTracks}
          currentAudioTrack={currentAudioTrack}
          onChange={onAudioTrackChange}
        />
        <QualitySelector
          qualities={qualities}
          currentQuality={currentQuality}
          onQualityChange={onQualityChange}
          onMenuToggle={onQualityMenuToggle}
          showMenu={showQualityMenu}
        />
        <SpeedSelector speed={playbackSpeed} onChange={onPlaybackSpeedChange} />
        <FullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
};