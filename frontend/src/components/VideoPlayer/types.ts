export interface Quality {
    height: number;
    name: string;
    level: number;
    bitrate?: number;
}

export interface AudioTrack {
    index: number;
    language: string;
    codec: string;
    channels: number;
    sampleRate: number;
    title?: string;
}

export interface SubtitleTrack {
    index: number;
    language: string;
    codec: string;
    title?: string;
    default?: boolean;
}

export interface VideoPlayerProps {
    videoId: string | null;
}