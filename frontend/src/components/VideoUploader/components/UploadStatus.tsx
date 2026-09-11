import React from 'react';

interface UploadStatusProps {
    isComplete: boolean;
    successMessage?: string | null;
    error?: string | null;
    onRetry?: () => void;
}

export const UploadStatus: React.FC<UploadStatusProps> = ({
    isComplete,
    successMessage,
    error,
    onRetry,
}) => {
    if (error) {
        return (
            <div style={{ marginTop: '1rem', color: 'red' }}>
                ❌ {error}
                {onRetry && (
                    <button style={{ marginLeft: '0.5rem' }} onClick={onRetry}>
                        Retry
                    </button>
                )}
            </div>
        );
    }

    if (isComplete && successMessage) {
        return (
            <div style={{ marginTop: '1rem', color: 'green', fontWeight: 500 }}>
                {successMessage}
            </div>
        );
    }

    return null;
};