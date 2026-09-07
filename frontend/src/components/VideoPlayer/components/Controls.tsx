import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { QualitySelector } from './QualitySelector';
import { AudioMenu } from './AudioMenu';
import { SubtitleMenu } from './SubtitleMenu';
import { PlaybackSpeedMenu } from './PlaybackSpeedMenu';
import type { Quality, AudioTrack, SubtitleTrack } from '../types';

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
    
    videoRef?: React.RefObject<HTMLVideoElement> | null;
    
    subtitlesEnabled: boolean;
    onSubtitlesToggle: () => void;

    playbackSpeed: number;
    onPlaybackSpeedChange: (speed: number) => void;
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
}) => {
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    const [showAudioMenu, setShowAudioMenu] = useState(false);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

    const getCurrentAudioLabel = () => {
        if (audioTracks.length <= 1) return null;
        const track = audioTracks[currentAudioTrack];
        return track?.language || `Track ${currentAudioTrack + 1}`;
    };

    const getCurrentSubtitleLabel = () => {
        if (subtitleTracks.length === 0) return null;
        if (!subtitlesEnabled) return 'Off';
        const track = subtitleTracks[currentSubtitleTrack];
        return track?.language || `Track ${currentSubtitleTrack + 1}`;
    };

    const handleSubtitleChange = (index: number) => {
        console.log(`📝 Controls: Seleccionado subtítulo ${index}`);
        onSubtitleTrackChange(index);

        if (!subtitlesEnabled) {
            onSubtitlesToggle();
        }
        setShowSubtitleMenu(false);
    };

    return (
        <div
            className="controls-overlay"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '1rem 1rem 0.75rem',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: showControls ? 'auto' : 'none',
            }}
        >
            <ProgressBar
                currentTime={currentTime}
                duration={duration}
                bufferedProgress={bufferedProgress}
                onSeek={onSeek}
            />

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'white',
                flexWrap: 'wrap',
            }}>
                {/* play/pause */}
                <button
                    onClick={onTogglePlay}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    {isPlaying ? '⏸️' : '▶️'}
                </button>

                {/* volume */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button
                        onClick={onToggleMute}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            padding: '0.25rem',
                        }}
                    >
                        {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={onVolumeChange}
                        style={{
                            width: '60px',
                            height: '3px',
                            background: 'rgba(255,255,255,0.3)',
                            borderRadius: '2px',
                            outline: 'none',
                            cursor: 'pointer',
                            accentColor: '#7c3aed',
                        }}
                    />
                </div>

                {/* time */}
                <span style={{ fontSize: '0.8rem', minWidth: '80px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* spacer */}
                <div style={{ flex: 1 }} />

                {/* subtitle selector */}
                {subtitleTracks.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                            style={{
                                background: subtitlesEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: 'white',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = subtitlesEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)';
                            }}
                        >
                            💬 {getCurrentSubtitleLabel()}
                            <span style={{ fontSize: '0.6rem' }}>▼</span>
                        </button>

                        {showSubtitleMenu && (
                            <SubtitleMenu
                                subtitleTracks={subtitleTracks}
                                currentSubtitleTrack={currentSubtitleTrack}
                                onSubtitleTrackChange={handleSubtitleChange}
                                onClose={() => setShowSubtitleMenu(false)}
                                subtitlesEnabled={subtitlesEnabled}
                                onToggleSubtitles={onSubtitlesToggle}
                            />
                        )}
                    </div>
                )}

                {/* audio Selector */}
                {audioTracks.length > 1 && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowAudioMenu(!showAudioMenu)}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: 'white',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            }}
                        >
                            🔊 {getCurrentAudioLabel()}
                            <span style={{ fontSize: '0.6rem' }}>▼</span>
                        </button>

                        {showAudioMenu && (
                            <AudioMenu
                                audioTracks={audioTracks}
                                currentAudioTrack={currentAudioTrack}
                                onAudioTrackChange={(index) => {
                                    onAudioTrackChange(index);
                                    setShowAudioMenu(false);
                                }}
                                onClose={() => setShowAudioMenu(false)}
                            />
                        )}
                    </div>
                )}

                {/* Quality selector */}
                <QualitySelector
                    qualities={qualities}
                    currentQuality={currentQuality}
                    onQualityChange={onQualityChange}
                    onMenuToggle={onQualityMenuToggle}
                    showMenu={showQualityMenu}
                />

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'background 0.2s ease',
                        }}
                    >
                        ⏱️ {playbackSpeed}x
                        <span style={{ fontSize: '0.6rem' }}>▼</span>
                    </button>

                    {showSpeedMenu && (
                        <PlaybackSpeedMenu
                            currentSpeed={playbackSpeed}
                            onSpeedChange={onPlaybackSpeedChange}
                            onClose={() => setShowSpeedMenu(false)}
                        />
                    )}
                </div>

                {/* Fullscreen */}
                <button
                    onClick={onToggleFullscreen}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                    {isFullscreen ? '⛶' : '⛶'}
                </button>
            </div>
        </div>
    );
};