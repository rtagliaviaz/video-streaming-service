import React from 'react';

export const VolumeControl: React.FC<{
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ isMuted, volume, onToggleMute, onVolumeChange }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.25rem',
  };

  const sliderStyle: React.CSSProperties = {
    width: '60px',
    height: '3px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#7c3aed',
  };

  return (
    <div style={containerStyle}>
      <button onClick={onToggleMute} style={buttonStyle}>
        {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={onVolumeChange}
        style={sliderStyle}
      />
    </div>
  );
};