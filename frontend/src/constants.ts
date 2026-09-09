export const QUALITY_OPTIONS = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p'] as const;
export const DEFAULT_QUALITIES = ['480p', '720p', '1080p', '1440p'];
export type QualityOption = typeof QUALITY_OPTIONS[number];