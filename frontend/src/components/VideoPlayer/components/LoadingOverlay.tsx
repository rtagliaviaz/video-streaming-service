import React from 'react';

interface LoadingOverlayProps {
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isLoading,
    error,
    onRetry,
}) => {
    if (isLoading) {
        return (
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontSize: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTop: '3px solid #7c3aed',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <span>Loading...</span>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                textAlign: 'center',
                padding: '2rem',
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
                <p>{error}</p>
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 1.2rem',
                        background: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return null;
};