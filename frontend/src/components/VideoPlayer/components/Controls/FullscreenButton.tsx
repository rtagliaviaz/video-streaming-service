import React from 'react';

export const FullscreenButton: React.FC<{
  isFullscreen: boolean;
  onToggle: () => void;
}> = ({ isFullscreen, onToggle }) => {
  const style: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.25rem',
    transition: 'transform 0.2s ease',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.1)';
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <button
      onClick={onToggle}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
    >
      ⛶
    </button>
  );
};