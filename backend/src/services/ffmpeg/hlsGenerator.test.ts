import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateHLS } from './hlsGenerator';
import { getVideoInfo } from './videoInfo';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { generateMasterPlaylist } from './playlistGenerator';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ProgressInfo } from './types';

vi.mock('./videoInfo');
vi.mock('./gpuDetector');
vi.mock('./thumbnailGenerator');
vi.mock('./playlistGenerator');

vi.mock('child_process', () => ({
    spawn: vi.fn(),
    exec: vi.fn(),
}));

vi.mock('fs', () => {
    const mockFs = {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        unlinkSync: vi.fn(),
        rmSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
    return {
        default: mockFs,
        ...mockFs,
    };
});

vi.mock('path', () => ({
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn(),
    basename: vi.fn(),
    resolve: vi.fn(),
    default: {
        join: vi.fn((...args: string[]) => args.join('/')),
        dirname: vi.fn(),
        basename: vi.fn(),
        resolve: vi.fn(),
    },
}));

describe('hlsGenerator', () => {
    const mockInputPath = '/fake/input.mp4';
    const mockOutputDir = '/fake/output';
    const mockVideoId = 'video_123';
    const mockOnProgress = vi.fn();

    const mockVideoInfo = {
        width: 1920,
        height: 1080,
        duration: 120,
        fps: 24,
        gopSize: 48,
        audioTracks: [{ index: 0, language: 'eng', codec: 'aac', channels: 2, sampleRate: 48000 }],
        subtitleTracks: [],
        codec: 'h264',
        durationFormatted: '00:02:00',
    };

    const mockGPUInfo = { hasGPU: true, encoder: 'h264_nvenc', gpuInfo: 'RTX 3060', supportsHevc: false };
    const mockThumbnails = ['thumb1.jpg', 'thumb2.jpg'];

    const createMockProc = (exitCode: number = 0, stderrData: string = '') => {
        const proc = {
            stderr: {
                on: vi.fn((event: string, cb: (data: Buffer) => void) => {
                    if (event === 'data' && stderrData) {
                        setTimeout(() => cb(Buffer.from(stderrData)), 10);
                    }
                }),
            },
            on: vi.fn((event: string, cb: (code: number) => void) => {
                if (event === 'close') {
                    setTimeout(() => cb(exitCode), 20);
                }
            }),
        };
        return proc;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (fs.existsSync as any).mockReturnValue(false);
        (fs.mkdirSync as any).mockReturnValue(undefined);
        (path.join as any).mockImplementation((...args: string[]) => args.join('/'));

        (getVideoInfo as any).mockResolvedValue(mockVideoInfo);
        (checkGPUAvailability as any).mockResolvedValue(mockGPUInfo);
        (generateThumbnails as any).mockResolvedValue({
            thumbnails: mockThumbnails,
            sprite: '/fake/sprite.jpg',
            vtt: '/fake/thumbnails.vtt',
        });
        (generateMasterPlaylist as any).mockImplementation(() => {});

        (spawn as any).mockImplementation(() => createMockProc(0));
    });

    it('should call getVideoInfo with inputPath', async () => {
        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(getVideoInfo).toHaveBeenCalledWith(mockInputPath);
    });

    it('should call checkGPUAvailability', async () => {
        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(checkGPUAvailability).toHaveBeenCalled();
    });

    it('should call generateThumbnails', async () => {
        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(generateThumbnails).toHaveBeenCalledWith(mockInputPath, mockOutputDir, mockVideoId, 40);
    });

    it('should call generateMasterPlaylist', async () => {
        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(generateMasterPlaylist).toHaveBeenCalledTimes(1);
        expect(generateMasterPlaylist).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.any(Array),
            expect.any(Array)
        );
    });

    it('should use libx264 when GPU is not available', async () => {
        (checkGPUAvailability as any).mockResolvedValue({
            hasGPU: false,
            encoder: 'libx264',
        });

        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-c:v');
        const codecIndex = capturedArgs.indexOf('-c:v') + 1;
        expect(capturedArgs[codecIndex]).toBe('libx264');
        expect(capturedArgs).toContain('-preset');
        const presetIndex = capturedArgs.indexOf('-preset') + 1;
        expect(capturedArgs[presetIndex]).toBe('fast');
    });

    it('should use h264_nvenc when GPU is available (H.264)', async () => {
        (checkGPUAvailability as any).mockResolvedValue({
            hasGPU: true,
            encoder: 'h264_nvenc',
            gpuInfo: 'RTX 3060',
            supportsHevc: false,
        });

        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-c:v');
        const codecIndex = capturedArgs.indexOf('-c:v') + 1;
        expect(capturedArgs[codecIndex]).toBe('h264_nvenc');
        expect(capturedArgs).toContain('-preset');
        const presetIndex = capturedArgs.indexOf('-preset') + 1;
        expect(capturedArgs[presetIndex]).toBe('p4');
        expect(capturedArgs).toContain('-rc');
        expect(capturedArgs).toContain('-cq');
        expect(capturedArgs).toContain('-spatial_aq');
    });

    it('should include GOP size', async () => {
        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-g');
        const gopIndex = capturedArgs.indexOf('-g') + 1;
        expect(capturedArgs[gopIndex]).toBe('48');
    });

    it('should process 7 qualities', async () => {
        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            audioTracks: [],
            subtitleTracks: [],
        });

        (spawn as any).mockImplementation(() => createMockProc(0));

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        const spawnCalls = (spawn as any).mock.calls;
        const qualityCalls = spawnCalls.filter((call: any[]) => {
            const args = call[1] || [];
            return args.includes('-f') && args.includes('hls');
        });
        expect(qualityCalls.length).toBe(7);
    });

    it('should call onProgress with structured progress', async () => {
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            const proc = {
                stderr: {
                    on: vi.fn((event: string, cb: (data: Buffer) => void) => {
                        if (event === 'data') {
                            setTimeout(() => {
                                cb(Buffer.from('Duration: 00:02:00.00\n'));
                            }, 5);
                            setTimeout(() => {
                                cb(Buffer.from('time=00:00:10.00\n'));
                            }, 15);
                            setTimeout(() => {
                                cb(Buffer.from('time=00:00:20.00\n'));
                            }, 25);
                        }
                    }),
                },
                on: vi.fn((event: string, cb: (code: number) => void) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 35);
                    }
                }),
            };
            return proc;
        });

        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            duration: 120,
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(mockOnProgress).toHaveBeenCalled();
        const calls = mockOnProgress.mock.calls;
        const progressInfoCall = calls.find((call: any[]) => call[0]?.percent !== undefined);
        expect(progressInfoCall).toBeDefined();
        const progressInfo = progressInfoCall?.[0];
        expect(progressInfo).toBeDefined();
        expect(progressInfo.percent).toBeGreaterThan(0);
        expect(progressInfo.stage).toBeDefined();
    });

    it('should handle missing audio tracks', async () => {
        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            audioTracks: [],
        });

        (spawn as any).mockImplementation(() => createMockProc(0));

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(generateMasterPlaylist).toHaveBeenCalled();
    });

    it('should handle missing subtitle tracks', async () => {
        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            subtitleTracks: [],
        });

        (spawn as any).mockImplementation(() => createMockProc(0));

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(generateMasterPlaylist).toHaveBeenCalled();
    });

    it('should emit progress stages in correct order', async () => {
        const progressCalls: ProgressInfo[] = [];
        const onProgress = (info: ProgressInfo) => {
            progressCalls.push(info);
        };

        (spawn as any).mockImplementation(() => createMockProc(0));

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, onProgress);

        const stages = progressCalls.map(p => p.stage);
        expect(stages).toContain('thumbnails');
        expect(stages).toContain('audio');
        expect(stages).toContain('subtitles');
        const hasQualityStage = stages.includes('h264') || stages.includes('hevc');
        expect(hasQualityStage).toBe(true);
        expect(stages).toContain('done');
    });

    it('should use hevc_nvenc when GPU supports HEVC (Windows)', async () => {
        (checkGPUAvailability as any).mockResolvedValue({
            hasGPU: true,
            encoder: 'hevc_nvenc',
            gpuInfo: 'RTX 3060',
            supportsHevc: true,
        });

        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-c:v');
        const codecIndex = capturedArgs.indexOf('-c:v') + 1;
        expect(capturedArgs[codecIndex]).toBe('hevc_nvenc');
        expect(capturedArgs).toContain('-preset');
        const presetIndex = capturedArgs.indexOf('-preset') + 1;
        expect(capturedArgs[presetIndex]).toBe('p5');
        expect(capturedArgs).toContain('-profile:v');
        const profileIndex = capturedArgs.indexOf('-profile:v') + 1;
        expect(capturedArgs[profileIndex]).toBe('main');
        expect(capturedArgs).toContain('-rc');
        expect(capturedArgs).toContain('-cq');
        expect(capturedArgs).toContain('-spatial_aq');
    });

    it('should use fMP4 segments and init file for CMAF', async () => {
        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-hls_segment_type');
        const segTypeIndex = capturedArgs.indexOf('-hls_segment_type') + 1;
        expect(capturedArgs[segTypeIndex]).toBe('fmp4');
        expect(capturedArgs).toContain('-hls_fmp4_init_filename');
        expect(capturedArgs).toContain('-hls_flags');
        const flagsIndex = capturedArgs.indexOf('-hls_flags') + 1;
        expect(capturedArgs[flagsIndex]).toContain('independent_segments');
        expect(capturedArgs[flagsIndex]).toContain('program_date_time');
    });

    it('should use segment duration from config (2 seconds)', async () => {
        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-hls_time');
        const hlsTimeIndex = capturedArgs.indexOf('-hls_time') + 1;
        expect(capturedArgs[hlsTimeIndex]).toBe('2');
    });

    it('should use fMP4 for audio segments as well', async () => {
        let audioSpawnCalls: any[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            audioSpawnCalls.push({ cmd, args });
            return createMockProc(0);
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        const audioCall = audioSpawnCalls.find(call => 
            call.args.includes('-map') && call.args.includes('0:a:0')
        );
        expect(audioCall).toBeDefined();
        expect(audioCall.args).toContain('-hls_segment_type');
        const segTypeIdx = audioCall.args.indexOf('-hls_segment_type') + 1;
        expect(audioCall.args[segTypeIdx]).toBe('fmp4');
        expect(audioCall.args).toContain('-hls_fmp4_init_filename');
        const initIdx = audioCall.args.indexOf('-hls_fmp4_init_filename') + 1;
        expect(audioCall.args[initIdx]).toMatch(/^init_audio_\d+\.mp4$/);
    });
});