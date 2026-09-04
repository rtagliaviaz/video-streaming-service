export interface Video {
    id: string;
    originalName?: string; // ✅ ✅ ✅ NUEVO
    exists: boolean;
    playlist: string | null;
    qualities?: string[];
    thumbnails?: string[];
    createdAt: string;
    duration?: number;
    durationFormatted?: string;
    size?: number;
}

export interface VideoListProps {
    onSelectVideo: (videoId: string) => void;
    selectedVideoId?: string | null;
}