import React from 'react';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    bufferedProgress: number;
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    currentTime,
    duration,
    bufferedProgress,
    onSeek,
}) => {
    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPercentage = Math.min(bufferedProgress, 100);

    return (
        <div style={{
            position: 'relative',
            marginBottom: '0.5rem',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            cursor: 'pointer',
        }}>
            {/* buffered progress */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${bufferedPercentage}%`,
                    background: 'rgba(255,255,255,0.3)',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease',
                    pointerEvents: 'none',
                }}
            />
            
            {/* played progress */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${progressPercentage}%`,
                    background: '#7c3aed',
                    borderRadius: '2px',
                    transition: 'width 0.1s linear',
                    pointerEvents: 'none',
                }}
            />
            
            {/* seek input */}
            <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={onSeek}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    padding: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                }}
            />
        </div>
    );
};