import { QualityProfile } from './types';

export const QUALITY_PROFILES: QualityProfile[] = [
    {
        name: '144p',
        resolution: '256:144',
        bitrate: '150k',
        maxrate: '200k',
        bufsize: '300k',
        height: 144,
        width: 256
    },
    {
        name: '240p',
        resolution: '426:240',
        bitrate: '300k',
        maxrate: '400k',
        bufsize: '600k',
        height: 240,
        width: 426
    },
    {
        name: '360p',
        resolution: '640:360',
        bitrate: '600k',
        maxrate: '800k',
        bufsize: '1200k',
        height: 360,
        width: 640
    },
    {
        name: '480p',
        resolution: '854:480',
        bitrate: '1200k',
        maxrate: '1500k',
        bufsize: '2000k',
        height: 480,
        width: 854
    },
    {
        name: '720p',
        resolution: '1280:720',
        bitrate: '2500k',
        maxrate: '3000k',
        bufsize: '4000k',
        height: 720,
        width: 1280
    },
    {
        name: '1080p',
        resolution: '1920:1080',
        bitrate: '5000k',
        maxrate: '6000k',
        bufsize: '8000k',
        height: 1080,
        width: 1920
    },
    {
        name: '1440p',
        resolution: '2560:1440',
        bitrate: '8000k',
        maxrate: '10000k',
        bufsize: '12000k',
        height: 1440,
        width: 2560
    }
];

export const getQualitiesByNames = (names: string[]): QualityProfile[] => {
    if (!names || names.length === 0) return QUALITY_PROFILES;
    return QUALITY_PROFILES.filter(q => names.includes(q.name));
};

export const HLS_CONFIG = {
    segmentDuration: 2,
    audioBitrate: '128k',
    audioCodec: 'aac',
    videoPresetGPU: 'p4',
    videoPresetCPU: 'fast',
    useFmp4: true,
    enableHevc: true,
};

