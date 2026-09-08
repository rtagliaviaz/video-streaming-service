import React, { useState } from 'react';
import { PlaybackSpeedMenu } from '../PlaybackSpeedMenu';

export const SpeedSelector: React.FC<{
  speed: number;
  onChange: (speed: number) => void;
}> = ({ speed, onChange }) => {
  const [showMenu, setShowMenu] = useState(false);

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
        ⏱️ {speed}x <span style={arrowStyle}>▼</span>
      </button>
      {showMenu && (
        <PlaybackSpeedMenu
          currentSpeed={speed}
          onSpeedChange={(newSpeed) => {
            onChange(newSpeed);
            setShowMenu(false);
          }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};