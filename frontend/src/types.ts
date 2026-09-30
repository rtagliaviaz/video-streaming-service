export interface QualityStatus {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProgressInfo {
  percent: number;
  stage: 'idle' | 'audio' | 'subtitles' | 'thumbnails' | 'qualities' | 'h264' | 'hevc' | 'hls-packaging' | 'dash-packaging' | 'done';
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
    qualitiesStatus?: QualityStatus[];
  };
}