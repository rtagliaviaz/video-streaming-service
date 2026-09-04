import React from 'react';

interface ProgressBarProps {
    label: string;
    icon: string;
    progress: number;
    color: 'upload' | 'processing' | 'complete';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    label,
    icon,
    progress,
    color,
}) => {
    if (progress === 0) return null;

    return (
        <div style={{ marginTop: '0.75rem' }}>
            <div className="progress-bar">
                <div className={`fill ${color}`} style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <span style={{ fontSize: '0.85rem' }}>
                {icon} {label}: {Math.min(progress, 100)}%
            </span>
        </div>
    );
};