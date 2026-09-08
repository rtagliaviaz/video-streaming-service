import React, { useState } from 'react';
import { SubtitleMenu } from '../SubtitleMenu';
import type { SubtitleTrack } from '../../types';

export const SubtitleSelector: React.FC<{
  subtitleTracks: SubtitleTrack[];
  currentSubtitleTrack: number;
  subtitlesEnabled: boolean;
  onToggle: () => void;
  onChange: (index: number) => void;
}> = ({ subtitleTracks, currentSubtitleTrack, subtitlesEnabled, onToggle, onChange }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (subtitleTracks.length === 0) return null;

  const label = subtitlesEnabled
    ? subtitleTracks[currentSubtitleTrack]?.language || `Track ${currentSubtitleTrack + 1}`
    : 'Off';

  const buttonStyle: React.CSSProperties = {
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
  };

  const wrapperStyle: React.CSSProperties = { position: 'relative' };
  const arrowStyle: React.CSSProperties = { fontSize: '0.6rem' };

  return (
    <div style={wrapperStyle}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={buttonStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = subtitlesEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)';
        }}
      >
        💬 {label} <span style={arrowStyle}>▼</span>
      </button>
      {showMenu && (
        <SubtitleMenu
          subtitleTracks={subtitleTracks}
          currentSubtitleTrack={currentSubtitleTrack}
          onSubtitleTrackChange={(index) => {
            onChange(index);
            setShowMenu(false);
          }}
          onClose={() => setShowMenu(false)}
          subtitlesEnabled={subtitlesEnabled}
          onToggleSubtitles={onToggle}
        />
      )}
    </div>
  );
};