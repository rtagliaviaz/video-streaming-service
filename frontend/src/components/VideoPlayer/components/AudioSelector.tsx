import React from 'react';
import type { AudioTrack } from '../types';

interface AudioSelectorProps {
    audioTracks: AudioTrack[];
    currentAudioTrack: number;
    onAudioTrackChange: (trackIndex: number) => void;
}

export const AudioSelector: React.FC<AudioSelectorProps> = ({
    audioTracks,
    currentAudioTrack,
}) => {
    if (audioTracks.length <= 1) return null;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => {
                    // toggle menu - lo manejamos desde el padre
                }}
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
                🔊 {audioTracks[currentAudioTrack]?.language || 'Audio'}
                <span style={{ fontSize: '0.6rem' }}>▼</span>
            </button>
        </div>
    );
};