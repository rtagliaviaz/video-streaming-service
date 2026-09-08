import React from 'react';

export const TimeDisplay: React.FC<{
  currentTime: number;
  duration: number;
  formatTime: (s: number) => string;
}> = ({ currentTime, duration, formatTime }) => {
  const style: React.CSSProperties = {
    fontSize: '0.8rem',
    minWidth: '80px',
    fontVariantNumeric: 'tabular-nums',
    color: 'white',
  };

  return (
    <span style={style}>
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
};