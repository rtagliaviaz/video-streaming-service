import React from 'react';

interface UploadStatusProps {
    isComplete: boolean;
    error: string | null;
    onRetry?: () => void;
}

export const UploadStatus: React.FC<UploadStatusProps> = ({
    isComplete,
    error,
    onRetry,
}) => {
    if (isComplete) {
        return (
            <div style={{ 
                marginTop: '0.75rem', 
                padding: '0.75rem',
                background: 'var(--success-bg)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--success)',
                fontWeight: '500'
            }}>
                ✅ Video processed successfully!
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                marginTop: '0.75rem', 
                padding: '0.75rem',
                background: 'var(--error-bg)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--error)',
                fontWeight: '500',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
            }}>
                <span>❌ {error}</span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        style={{
                            padding: '0.2rem 0.8rem',
                            background: 'var(--error)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                        }}
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    return null;
};