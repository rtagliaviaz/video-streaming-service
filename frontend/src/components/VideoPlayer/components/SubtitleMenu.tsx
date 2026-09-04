import React from 'react';
import type { SubtitleTrack } from '../types';

interface SubtitleMenuProps {
    subtitleTracks: SubtitleTrack[];
    currentSubtitleTrack: number;
    onSubtitleTrackChange: (trackIndex: number) => void;
    onClose: () => void;
    subtitlesEnabled: boolean;
    onToggleSubtitles: () => void;
}

export const SubtitleMenu: React.FC<SubtitleMenuProps> = ({
    subtitleTracks,
    currentSubtitleTrack,
    onSubtitleTrackChange,
    onClose,
    subtitlesEnabled,
    onToggleSubtitles,
}) => {
    if (subtitleTracks.length === 0) return null;

    const handleSelect = (index: number) => {
        onSubtitleTrackChange(index);
        onClose();
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '0.5rem',
                background: 'rgba(20,20,30,0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '8px',
                padding: '0.4rem',
                minWidth: '180px',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 1000,
            }}
        >
            <div style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.5)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                marginBottom: '0.3rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}>
                Subtitles
            </div>

            {/* opción para desactivar subtítulos */}
            <button
                onClick={() => {
                    onToggleSubtitles();
                    onClose();
                }}
                style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    background: !subtitlesEnabled ? 'rgba(124,58,237,0.3)' : 'transparent',
                    border: 'none',
                    color: !subtitlesEnabled ? '#a78bfa' : 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                    if (!subtitlesEnabled) {
                        e.currentTarget.style.background = 'rgba(124,58,237,0.3)';
                    } else {
                        e.currentTarget.style.background = 'transparent';
                    }
                }}
            >
                🚫 Off
                {!subtitlesEnabled && ' ✓'}
            </button>

            {/* opciones de subtítulos */}
            {subtitleTracks.map((track, index) => {
                const isActive = subtitlesEnabled && currentSubtitleTrack === index;
                return (
                    <button
                        key={index}
                        onClick={() => handleSelect(index)}
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            background: isActive ? 'rgba(124,58,237,0.3)' : 'transparent',
                            border: 'none',
                            color: isActive ? '#a78bfa' : 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                            } else {
                                e.currentTarget.style.background = 'rgba(124,58,237,0.3)';
                            }
                        }}
                    >
                        {track.language || `Track ${index + 1}`}
                        {track.codec && ` (${track.codec})`}
                        {isActive && ' ✓'}
                    </button>
                );
            })}
        </div>
    );
};