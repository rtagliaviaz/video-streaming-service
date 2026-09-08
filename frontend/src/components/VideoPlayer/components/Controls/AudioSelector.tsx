import React, { useState } from 'react';
import { AudioMenu } from '../AudioMenu';
import type { AudioTrack } from '../../types';

export const AudioSelector: React.FC<{
  audioTracks: AudioTrack[];
  currentAudioTrack: number;
  onChange: (index: number) => void;
}> = ({ audioTracks, currentAudioTrack, onChange }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (audioTracks.length <= 1) return null;

  const label = audioTracks[currentAudioTrack]?.language || `Track ${currentAudioTrack + 1}`;

  const buttonStyle: React.CSSProperties = {
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
  };

  const wrapperStyle: React.CSSProperties = { position: 'relative' };
  const arrowStyle: React.CSSProperties = { fontSize: '0.6rem' };

  return (
    <div style={wrapperStyle}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={buttonStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      >
        🔊 {label} <span style={arrowStyle}>▼</span>
      </button>
      {showMenu && (
        <AudioMenu
          audioTracks={audioTracks}
          currentAudioTrack={currentAudioTrack}
          onAudioTrackChange={(index) => {
            onChange(index);
            setShowMenu(false);
          }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};