import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVideoInfo } from './videoInfo';
import ffmpeg from 'fluent-ffmpeg';

vi.mock('fluent-ffmpeg', () => ({
    default: {
        ffprobe: vi.fn(),
    },
}));

describe('videoInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract video info correctly', async () => {
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
                    tags: { language: 'eng' },
                },
            ],
        };

        (ffmpeg.ffprobe as any).mockImplementation((path: string, callback: (err: any, metadata: any) => void) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.duration).toBe(120.5);
        expect(result.audioTracks).toHaveLength(1);
        expect(result.audioTracks[0].language).toBe('eng');
        expect(result.fps).toBeCloseTo(23.976, 2);
        expect(result.gopSize).toBe(48);
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

        (ffmpeg.ffprobe as any).mockImplementation((path: string, callback: (err: any, metadata: any) => void) => {
            callback(null, mockMetadata);
        });

        const result = await getVideoInfo('/fake/path.mp4');

        expect(result.fps).toBe(24);
        expect(result.gopSize).toBe(48);
    });

    it('should handle ffprobe errors', async () => {
        (ffmpeg.ffprobe as any).mockImplementation((path: string, callback: (err: any, metadata: any) => void) => {
            callback(new Error('FFprobe failed'), null);
        });

        await expect(getVideoInfo('/fake/path.mp4')).rejects.toThrow('FFprobe failed');
    });
});