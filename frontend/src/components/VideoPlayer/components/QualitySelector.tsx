import React from 'react';
import type { Quality } from '../types';

interface QualitySelectorProps {
    qualities: Quality[];
    currentQuality: string;
    onQualityChange: (level: number) => void;
    onMenuToggle: () => void;
    showMenu: boolean;
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
    qualities,
    currentQuality,
    onQualityChange,
    onMenuToggle,
    showMenu,
}) => {
    const qualityOptions = [...qualities].sort((a, b) => a.height - b.height);

    const getCurrentQualityName = () => {
        if (currentQuality === 'auto') return 'Auto';
        const quality = qualities.find(q => q.name === currentQuality);
        return quality ? quality.name : currentQuality;
    };

    if (qualityOptions.length === 0) return null;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onMenuToggle}
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
                ⚙️ {getCurrentQualityName()}
                <span style={{ fontSize: '0.6rem' }}>▼</span>
            </button>

            {showMenu && (
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
                        Quality
                    </div>
                    <button
                        onClick={() => onQualityChange(-1)}
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            background: currentQuality === 'auto' ? 'rgba(124,58,237,0.3)' : 'transparent',
                            border: 'none',
                            color: currentQuality === 'auto' ? '#a78bfa' : 'white',
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
                            if (currentQuality !== 'auto') {
                                e.currentTarget.style.background = 'transparent';
                            } else {
                                e.currentTarget.style.background = 'rgba(124,58,237,0.3)';
                            }
                        }}
                    >
                        🔀 Auto (Adaptive)
                    </button>
                    {qualityOptions.map((q) => (
                        <button
                            key={q.level}
                            onClick={() => onQualityChange(q.level)}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.4rem 0.6rem',
                                background: currentQuality === q.name ? 'rgba(124,58,237,0.3)' : 'transparent',
                                border: 'none',
                                color: currentQuality === q.name ? '#a78bfa' : 'white',
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
                                if (currentQuality !== q.name) {
                                    e.currentTarget.style.background = 'transparent';
                                } else {
                                    e.currentTarget.style.background = 'rgba(124,58,237,0.3)';
                                }
                            }}
                        >
                            {q.name} {q.bitrate ? `(${Math.round(q.bitrate / 1000)} kbps)` : ''}
                            {currentQuality === q.name && ' ✓'}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};