import React from 'react';

interface PlaybackSpeedMenuProps {
    currentSpeed: number;
    onSpeedChange: (speed: number) => void;
    onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const PlaybackSpeedMenu: React.FC<PlaybackSpeedMenuProps> = ({
    currentSpeed,
    onSpeedChange,
    onClose,
}) => {
    const handleSelect = (speed: number) => {
        onSpeedChange(speed);
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
                minWidth: '120px',
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
                Speed
            </div>
            {SPEEDS.map((speed) => (
                <button
                    key={speed}
                    onClick={() => handleSelect(speed)}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        background: currentSpeed === speed ? 'rgba(124,58,237,0.3)' : 'transparent',
                        border: 'none',
                        color: currentSpeed === speed ? '#a78bfa' : 'white',
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
                        if (currentSpeed !== speed) {
                            e.currentTarget.style.background = 'transparent';
                        } else {
                            e.currentTarget.style.background = 'rgba(124,58,237,0.3)';
                        }
                    }}
                >
                    {speed}x
                    {currentSpeed === speed && ' ✓'}
                </button>
            ))}
        </div>
    );
};