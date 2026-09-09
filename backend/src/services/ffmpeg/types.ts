export interface QualityProfile {
    name: string;
    resolution: string;
    bitrate: string;
    maxrate: string;
    bufsize: string;
    height: number;
    width: number;
}

export interface AudioTrack {
    index: number;
    language?: string;
    codec: string;
    channels: number;
    sampleRate: number;
    title?: string;
}

export interface SubtitleTrack {
    index: number;
    language?: string;
    codec: string;
    title?: string;
    default?: boolean;
}

export interface VideoInfo {
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
    duration: number;
    durationFormatted?: string;
    width: number;
    height: number;
    codec: string;
    fps: number;
    gopSize: number;
}

export interface GPUInfo {
    hasGPU: boolean;
    encoder: string;
    gpuInfo?: string;
    supportsHevc?: boolean;
}

export interface CodecVariant {
    encoder: string;
    codecName: string;
    playlistPrefix: string; 
    segmentPrefix: string; 
    initPrefix: string;
    qualities: QualityProfile[];
    masterPlaylist: string;
}

export interface HLSResult {
    masterPlaylist: string;
    thumbnails: string[];
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
    thumbnailsSprite?: string;
    thumbnailsVtt?: string;
    codecVariants: CodecVariant[];
}

export interface VideoMetadata {
    id: string;
    originalName: string;
    createdAt: string;
    duration: number;
    durationFormatted?: string;
    size: number;
    qualities: string[];
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
}

export interface ProgressInfo {
    percent: number;
    stage: 'idle' | 'audio' | 'subtitles' | 'thumbnails' | 'h264' | 'hevc' | 'done';
    details?: {
        audioTracksExtracted?: number;
        totalAudioTracks?: number;
        subtitlesExtracted?: number;
        totalSubtitles?: number;
        thumbnailsGenerated?: number;
        totalThumbnails?: number;
        spriteGenerated?: boolean;
        completedQualities?: number;
        totalQualities?: number;
        currentQuality?: string;
        qualitiesStatus?: {
            name: string;
            status: 'pending' | 'processing' | 'completed' | 'failed';
        }[];
    };
}