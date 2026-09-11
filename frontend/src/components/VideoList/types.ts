import type React from 'react';

export interface Video {
    id: string;
    originalName: string;
    createdAt: string;
    duration: number;
    durationFormatted: string;
    size: number;
    exists: boolean;
    playlist: string | null;
    qualities: string[];
    thumbnails: string[] | null;
    status?: 'queued' | 'processing' | 'completed' | 'failed';
    jobId?: string | null;
}

export interface VideoListProps {
    onSelectVideo: (videoId: string) => void;
    selectedVideoId?: string;
}

export interface VideoItemProps {
    video: Video;
    isSelected: boolean;
    isDeleting: boolean;
    onToggleSelect: (videoId: string) => void;
    onPlayVideo: (videoId: string) => void;
    onDelete: (videoId: string, e: React.MouseEvent) => void;
}