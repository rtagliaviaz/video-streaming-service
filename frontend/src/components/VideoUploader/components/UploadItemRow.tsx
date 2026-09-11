import React, { useState } from 'react';
import { useSSE } from '../../../hooks/useSSE';
import { videoApi } from '../../../services/api';
import type { UploadItem } from '../types';
import type { ProgressInfo } from '../../../types';
import { ProcessingDetails } from './ProcessingDetails';
import { ProgressBar } from './ProgressBar';

interface UploadItemRowProps {
    item: UploadItem;
    formatFileSize: (bytes: number) => string;
    onRemove: (id: string) => void;
}

function mapStage(stage: string): ProgressInfo['stage'] {
    if (stage === 'h264' || stage === 'hevc') return 'qualities';
    if (['thumbnails', 'audio', 'subtitles', 'done', 'idle'].includes(stage)) {
        return stage as ProgressInfo['stage'];
    }
    return 'idle';
}

const getStatusBadge = (
    item: UploadItem,
    isComplete: boolean,
    error: string | null
) => {
    if (error || item.error) {
        return { text: '❌ Failed', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    }
    if (isComplete) {
        return { text: '✅ Done', bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
    }
    if (item.jobId) {
        if (item.stage === 'idle' || item.stage === 'queued') {
            return { text: '⏳ Queued', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' };
        }
        return { text: '⚙️ Processing', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' };
    }
    if (item.uploading) {
        return { text: '📤 Uploading', bg: 'rgba(124,58,237,0.1)', color: '#7c3aed' };
    }
    return { text: '🕒 Pending', bg: 'rgba(107,114,128,0.1)', color: '#6b7280' };
};

export const UploadItemRow: React.FC<UploadItemRowProps> = ({
    item,
    formatFileSize,
    onRemove,
}) => {
    const { progress, stage, details, isComplete, error } = useSSE(item.jobId);
    const [cancelBusy, setCancelBusy] = useState(false);

    const progressInfo: ProgressInfo | null = item.jobId
        ? {
              percent: progress || 0,
              stage: mapStage(stage || 'idle'),
              details: details || {},
          }
        : null;

    const showUploadBar = item.uploading && item.uploadProgress < 100;
    const showProcessing = !!item.jobId && !isComplete && !error;

    const badge = getStatusBadge(item, isComplete, error);
    const canRemove = !item.uploading && !item.jobId;
    const canCancel = !!item.jobId && !isComplete && !error && !cancelBusy;

    const handleCancel = async () => {
        if (!item.jobId) return;
        if (!confirm(`Cancel processing "${item.originalName}"?`)) return;
        setCancelBusy(true);
        try {
            await videoApi.cancelJob(item.jobId);
        } catch (err) {
            console.error('Cancel error:', err);
        } finally {
            setCancelBusy(false);
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'transparent',
                borderRadius: '6px',
                transition: 'background 0.2s ease',
                border: '1px solid transparent',
                marginBottom: '0.4rem',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'var(--text-h)',
                            wordBreak: 'break-all',
                        }}
                    >
                        {item.originalName}
                    </div>
                    <div
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--text)',
                            opacity: 0.7,
                            marginTop: '0.15rem',
                        }}
                    >
                        📦 {formatFileSize(item.fileSize)}
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexShrink: 0,
                    }}
                >
                    <span
                        style={{
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            padding: '0.15rem 0.6rem',
                            borderRadius: '9999px',
                            background: badge.bg,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {badge.text}
                    </span>

                    {canCancel && (
                        <button
                            onClick={handleCancel}
                            title="Cancel processing"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '0.2rem 0.3rem',
                                borderRadius: '4px',
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(245,158,11,0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            ⏹️
                        </button>
                    )}

                    {cancelBusy && (
                        <span style={{ fontSize: '1rem' }}>⏳</span>
                    )}

                    {canRemove && (
                        <button
                            onClick={() => onRemove(item.id)}
                            title="Remove"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '0.2rem 0.3rem',
                                borderRadius: '4px',
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </div>

            {showUploadBar && (
                <ProgressBar
                    label="Upload"
                    icon="📤"
                    progress={item.uploadProgress}
                    color="upload"
                />
            )}

            {showProcessing && <ProcessingDetails progressInfo={progressInfo} />}

            {(item.error || error) && (
                <div
                    style={{
                        color: '#ef4444',
                        fontSize: '0.8rem',
                    }}
                >
                    {item.error || error}
                </div>
            )}
        </div>
    );
};