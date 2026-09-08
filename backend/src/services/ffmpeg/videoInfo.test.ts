import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVideoInfo } from './videoInfo';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../../logger';

vi.mock('fluent-ffmpeg', () => ({
    default: {
        ffprobe: vi.fn(),
    },
}));

vi.mock('../../logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('videoInfo', () => {
    // helper para mock de ffprobe
    const getFfprobeMock = () => (ffmpeg.ffprobe as any);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract video info correctly (video + audio)', async () => {
        const mockMetadata = {
            format: { duration: 120.5 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 1920,
                    height: 1080,
                    r_frame_rate: '24000/1001',
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                    sample_rate: '48000',
                    tags: { language: 'eng', title: 'English Audio' },
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.duration).toBe(120.5);
        expect(result.durationFormatted).toBe('00:02:00');
        expect(result.codec).toBe('h264');
        expect(result.fps).toBeCloseTo(23.976, 2);
        expect(result.gopSize).toBe(48);
        expect(result.audioTracks).toHaveLength(1);
        expect(result.audioTracks[0].language).toBe('eng');
        expect(result.audioTracks[0].codec).toBe('aac');
        expect(result.audioTracks[0].channels).toBe(2);
        expect(result.audioTracks[0].sampleRate).toBe(48000);
        expect(result.subtitleTracks).toHaveLength(0);
    });

    it('should extract video info with subtitles', async () => {
        const mockMetadata = {
            format: { duration: 60 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 1280,
                    height: 720,
                    r_frame_rate: '30000/1001',
                },
                {
                    codec_type: 'subtitle',
                    codec_name: 'webvtt',
                    tags: { language: 'spa', title: 'Spanish Subs', default: '1' },
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.subtitleTracks).toHaveLength(1);
        expect(result.subtitleTracks[0].language).toBe('spa');
        expect(result.subtitleTracks[0].codec).toBe('webvtt');
        expect(result.subtitleTracks[0].title).toBe('Spanish Subs');
        expect(result.subtitleTracks[0].default).toBe(true);
        expect(result.fps).toBeCloseTo(29.97, 2);
        expect(result.gopSize).toBe(60);
    });

    it('should handle multiple audio and subtitle tracks', async () => {
        const mockMetadata = {
            format: { duration: 90 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 1920,
                    height: 1080,
                    r_frame_rate: '24/1',
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                    sample_rate: '44100',
                    tags: { language: 'eng' },
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                    sample_rate: '48000',
                    tags: { language: 'spa' },
                },
                {
                    codec_type: 'subtitle',
                    codec_name: 'webvtt',
                    tags: { language: 'eng' },
                },
                {
                    codec_type: 'subtitle',
                    codec_name: 'webvtt',
                    tags: { language: 'spa', default: '1' },
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.audioTracks).toHaveLength(2);
        expect(result.audioTracks[0].language).toBe('eng');
        expect(result.audioTracks[1].language).toBe('spa');
        expect(result.subtitleTracks).toHaveLength(2);
        expect(result.subtitleTracks[0].language).toBe('eng');
        expect(result.subtitleTracks[1].language).toBe('spa');
        expect(result.subtitleTracks[1].default).toBe(true);
    });

    it('should handle missing framerate gracefully', async () => {
        const mockMetadata = {
            format: { duration: 60 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 1280,
                    height: 720,
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.fps).toBe(24);
        expect(result.gopSize).toBe(48);
    });

    it('should use avg_frame_rate when r_frame_rate is missing', async () => {
        const mockMetadata = {
            format: { duration: 60 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 1280,
                    height: 720,
                    avg_frame_rate: '30000/1001',
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.fps).toBeCloseTo(29.97, 2);
        expect(result.gopSize).toBe(60);
    });

    it('should handle audio track without sample_rate', async () => {
        const mockMetadata = {
            format: { duration: 30 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 640,
                    height: 360,
                    r_frame_rate: '24/1',
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.audioTracks[0].sampleRate).toBe(44100);
    });

    it('should handle audio track with sample_rate as number', async () => {
        const mockMetadata = {
            format: { duration: 30 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 640,
                    height: 360,
                    r_frame_rate: '24/1',
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                    sample_rate: 48000,
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.audioTracks[0].sampleRate).toBe(48000);
    });

    it('should handle audio track without language or title', async () => {
        const mockMetadata = {
            format: { duration: 30 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 640,
                    height: 360,
                    r_frame_rate: '24/1',
                },
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.audioTracks[0].language).toBe('Track 1');
        expect(result.audioTracks[0].title).toBe('Audio 1');
    });

    it('should handle subtitle track without language or title', async () => {
        const mockMetadata = {
            format: { duration: 30 },
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'h264',
                    width: 640,
                    height: 360,
                    r_frame_rate: '24/1',
                },
                {
                    codec_type: 'subtitle',
                    codec_name: 'webvtt',
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.subtitleTracks[0].language).toBe('Subtitle 1');
        expect(result.subtitleTracks[0].title).toBe('Subtitle 1');
    });

    it('should handle video without any video stream', async () => {
        const mockMetadata = {
            format: { duration: 10 },
            streams: [
                {
                    codec_type: 'audio',
                    codec_name: 'aac',
                    channels: 2,
                },
            ],
        };

        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
        expect(result.codec).toBe('unknown');
        expect(result.fps).toBe(24);
        expect(result.gopSize).toBe(48);
        expect(result.audioTracks).toHaveLength(1);
    });

    it('should handle ffprobe errors', async () => {
        getFfprobeMock().mockImplementation((path: string, callback: Function) => {
            callback(new Error('FFprobe failed'), null);
        });

        await expect(getVideoInfo('/fake/path.mp4')).rejects.toThrow('FFprobe failed');
        expect(logger.error).toHaveBeenCalledWith(
            { error: 'FFprobe failed', inputPath: '/fake/path.mp4' },
            'ffprobe error'
        );
    });

    it('should format duration correctly', async () => {
        const testCases = [
            { seconds: 0, expected: '00:00:00' },
            { seconds: 30, expected: '00:00:30' },
            { seconds: 65, expected: '00:01:05' },
            { seconds: 3665, expected: '01:01:05' },
        ];

        for (const { seconds, expected } of testCases) {
            const mockMetadata = {
                format: { duration: seconds },
                streams: [
                    {
                        codec_type: 'video',
                        codec_name: 'h264',
                        width: 640,
                        height: 360,
                        r_frame_rate: '24/1',
                    },
                ],
            };

            getFfprobeMock().mockImplementation((path: string, callback: Function) => {
                callback(null, mockMetadata);
            });

            const result = await getVideoInfo('/fake/path.mp4');
            expect(result.durationFormatted).toBe(expected);
        }
    });

    it('should handle framerate parsing with non-standard formats', async () => {
        const testCases = [
            { fpsStr: '24', expected: 24 },
            { fpsStr: '30000/1001', expected: 29.97 },
            { fpsStr: '24000/1001', expected: 23.976 },
            { fpsStr: '50', expected: 50 },
            { fpsStr: 'invalid', expected: 24 },
            { fpsStr: '', expected: 24 },
            { fpsStr: undefined as any, expected: 24 },
        ];

        for (const { fpsStr, expected } of testCases) {
            const mockMetadata = {
                format: { duration: 30 },
                streams: [
                    {
                        codec_type: 'video',
                        codec_name: 'h264',
                        width: 640,
                        height: 360,
                        r_frame_rate: fpsStr,
                    },
                ],
            };

            getFfprobeMock().mockImplementation((path: string, callback: Function) => {
                callback(null, mockMetadata);
            });

            const result = await getVideoInfo('/fake/path.mp4');
            expect(result.fps).toBeCloseTo(expected, 2);
            const gopSize = Math.round(expected * 2);
            expect(result.gopSize).toBe(gopSize);
        }
    });
});