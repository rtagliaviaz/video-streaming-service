import React, { useState } from 'react';
import type { Video } from '../types';
import { videoApi } from '../../../services/api';

interface VideoItemProps {
    video: Video;
    isSelected: boolean;
    isDeleting: boolean;
    onToggleSelect: (videoId: string) => void;
    onPlayVideo: (videoId: string) => void;
    onDelete: (videoId: string, e: React.MouseEvent) => void;
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const getStatusBadge = (video: Video) => {
    switch (video.status) {
        case 'queued':
            return { text: '⏳ Queued', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' };
        case 'processing':
            return { text: '⚙️ Processing', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' };
        case 'failed':
            return { text: '❌ Failed', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    }
    if (!video.exists) {
        return { text: '❌ Missing', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    }
    return { text: '✅ Ready', bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
};

export const VideoItem: React.FC<VideoItemProps> = ({
    video,
    isSelected,
    isDeleting,
    onToggleSelect,
    onPlayVideo,
    onDelete,
}) => {
    const [actionBusy, setActionBusy] = useState(false);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onToggleSelect(video.id);
    };

    const handleTitleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (video.exists && video.status !== 'failed' && video.status !== 'processing' && video.status !== 'queued') {
            onPlayVideo(video.id);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(video.id, e);
    };

    const handleCancelClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!video.jobId) return;
        if (!confirm(`Cancel processing "${video.originalName}"?`)) return;
        setActionBusy(true);
        try {
            await videoApi.cancelJob(video.jobId);
        } catch (err) {
            console.error('Cancel error:', err);
        } finally {
            setActionBusy(false);
        }
    };

    const handleRetryClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!video.jobId) return;
        setActionBusy(true);
        try {
            await videoApi.retryJob(video.jobId);
            window.dispatchEvent(
                new CustomEvent('job-retried', {
                    detail: {
                        jobId: video.jobId,
                        videoId: video.id,
                        originalName: video.originalName,
                        fileSize: video.size,
                    },
                })
            );
        } catch (err) {
            console.error('Retry error:', err);
        } finally {
            setActionBusy(false);
        }
    };

    const badge = getStatusBadge(video);
    const isMissing = !video.exists && (video.status === 'completed' || !video.status);
    const isActive = video.status === 'processing' || video.status === 'queued';
    const isFailed = video.status === 'failed';

    return (
        <div
            className={`video-item ${isSelected ? 'selected' : ''}`}
            style={{
                cursor: 'default',
                opacity: isMissing ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: isSelected ? 'rgba(124,58,237,0.1)' : 'transparent',
                borderRadius: '6px',
                transition: 'background 0.2s ease',
                border: isSelected ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            }}
        >
            {video.exists && (
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: '#7c3aed',
                        flexShrink: 0,
                    }}
                />
            )}

            <div
                className="info"
                onClick={handleTitleClick}
                style={{
                    flex: 1,
                    cursor: video.exists ? 'pointer' : 'default',
                    minWidth: 0,
                }}
            >
                <div
                    className="name"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: 'var(--text-h)',
                        wordBreak: 'break-all',
                    }}
                >
                    {video.originalName || video.id}
                </div>
                <div
                    className="meta"
                    style={{
                        fontSize: '0.75rem',
                        color: 'var(--text)',
                        opacity: 0.7,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem 0.5rem',
                        marginTop: '0.15rem',
                    }}
                >
                    <span>📅 {formatDate(video.createdAt)}</span>
                    {video.size && <span>📦 {formatFileSize(video.size)}</span>}
                    {video.durationFormatted && <span>⏱️ {video.durationFormatted}</span>}
                    {video.qualities && video.qualities.length > 0 && (
                        <span>
                            {video.qualities.map(q => (
                                <span
                                    key={q}
                                    className="quality-badge"
                                    style={{
                                        display: 'inline-block',
                                        background: 'rgba(124,58,237,0.1)',
                                        color: '#7c3aed',
                                        padding: '0.05rem 0.4rem',
                                        borderRadius: '3px',
                                        fontSize: '0.6rem',
                                        fontWeight: '600',
                                        marginRight: '0.2rem',
                                    }}
                                >
                                    {q}
                                </span>
                            ))}
                        </span>
                    )}
                    {video.thumbnails && video.thumbnails.length > 0 && (
                        <span style={{ opacity: 0.5 }}>📸 {video.thumbnails.length}</span>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <span
                    className={`status ${video.exists ? 'ready' : 'missing'}`}
                    style={{
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        padding: '0.15rem 0.6rem',
                        borderRadius: '9999px',
                        background: badge.bg,
                        color: badge.color,
                    }}
                >
                    {badge.text}
                </span>

                {isActive && video.jobId && (
                    <button
                        onClick={handleCancelClick}
                        disabled={actionBusy}
                        title="Cancel processing"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: actionBusy ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            opacity: actionBusy ? 0.5 : 1,
                            padding: '0.2rem 0.3rem',
                            borderRadius: '4px',
                            transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!actionBusy) e.currentTarget.style.background = 'rgba(245,158,11,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {actionBusy ? '⏳' : '⏹️'}
                    </button>
                )}

                {isFailed && video.jobId && (
                    <button
                        onClick={handleRetryClick}
                        disabled={actionBusy}
                        title="Retry processing"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: actionBusy ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            opacity: actionBusy ? 0.5 : 1,
                            padding: '0.2rem 0.3rem',
                            borderRadius: '4px',
                            transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!actionBusy) e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {actionBusy ? '⏳' : '🔄'}
                    </button>
                )}

                {video.exists && (
                    <button
                        className="delete"
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        title="Delete video"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            opacity: isDeleting ? 0.5 : 1,
                            padding: '0.2rem 0.3rem',
                            borderRadius: '4px',
                            transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!isDeleting) e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {isDeleting ? '⏳' : '🗑️'}
                    </button>
                )}
            </div>
        </div>
    );
};