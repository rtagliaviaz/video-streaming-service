import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateHLS } from './hlsGenerator';
import { getVideoInfo } from './videoInfo';
import { checkGPUAvailability } from './gpuDetector';
import { generateThumbnails } from './thumbnailGenerator';
import { generateMasterPlaylist } from './playlistGenerator';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

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

    const mockGPUInfo = { hasGPU: true, encoder: 'h264_nvenc', gpuInfo: 'RTX 3060' };
    const mockThumbnails = ['thumb1.jpg', 'thumb2.jpg'];

    beforeEach(() => {
        vi.clearAllMocks();

        // reseteamos los mocks de fs a valores por defecto
        (fs.existsSync as any).mockReturnValue(false);
        (fs.mkdirSync as any).mockReturnValue(undefined);
        (path.join as any).mockImplementation((...args: string[]) => args.join('/'));

        (getVideoInfo as any).mockResolvedValue(mockVideoInfo);
        (checkGPUAvailability as any).mockResolvedValue(mockGPUInfo);
        (generateThumbnails as any).mockResolvedValue(mockThumbnails);
        (generateMasterPlaylist as any).mockImplementation(() => {});
    });

    it('should call getVideoInfo with inputPath', async () => {
        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(getVideoInfo).toHaveBeenCalledWith(mockInputPath);
    });

    it('should call checkGPUAvailability', async () => {
        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(checkGPUAvailability).toHaveBeenCalled();
    });

    it('should call generateThumbnails', async () => {
        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);
        expect(generateThumbnails).toHaveBeenCalledWith(mockInputPath, mockOutputDir, mockVideoId, 10);
    });

    it('should call generateMasterPlaylist', async () => {
        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

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
            return {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
            };
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-c:v');
        const codecIndex = capturedArgs.indexOf('-c:v') + 1;
        expect(capturedArgs[codecIndex]).toBe('libx264');
    });

    it('should use h264_nvenc when GPU is available', async () => {
        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
            };
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-c:v');
        const codecIndex = capturedArgs.indexOf('-c:v') + 1;
        expect(capturedArgs[codecIndex]).toBe('h264_nvenc');
    });

    it('should include GOP size', async () => {
        let capturedArgs: string[] = [];
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            capturedArgs = args;
            return {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
            };
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(capturedArgs).toContain('-g');
        const gopIndex = capturedArgs.indexOf('-g') + 1;
        expect(capturedArgs[gopIndex]).toBe('48');
    });

    it('should process 7 qualities', async () => {
    // forzar que no haya audio ni subtítulos para evitar llamadas extra de spawn
    (getVideoInfo as any).mockResolvedValue({
        ...mockVideoInfo,
        audioTracks: [],
        subtitleTracks: [],
    });

    (spawn as any).mockImplementation((cmd: string, args: string[]) => {
        return {
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => {
                if (event === 'close') cb(0);
            }),
        };
    });

    await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

    const spawnCalls = (spawn as any).mock.calls;
    // filtramos solo las llamadas de calidad (las que tienen -f hls)
    const qualityCalls = spawnCalls.filter((call: any[]) => {
        const args = call[1] || [];
        return args.includes('-f') && args.includes('hls');
    });
    expect(qualityCalls.length).toBe(7);
});

    it('should call onProgress', async () => {
        let progressCallback: (data: Buffer) => void;
        (spawn as any).mockImplementation((cmd: string, args: string[]) => {
            const proc = {
                stderr: {
                    on: vi.fn((event: string, cb: (data: Buffer) => void) => {
                        if (event === 'data') {
                            progressCallback = cb;
                            setTimeout(() => {
                                cb(Buffer.from('time=00:00:10.00\n'));
                            }, 10);
                        }
                    }),
                },
                on: vi.fn((event: string, cb: (code: number) => void) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 20);
                    }
                }),
            };
            return proc;
        });

        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            duration: 60,
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockOnProgress).toHaveBeenCalled();
        const calls = mockOnProgress.mock.calls;
        const progressValues = calls.map((call: number[]) => call[0]);
        expect(progressValues.some((val: number) => val > 0 && val <= 100)).toBe(true);
    });

    it('should handle FFmpeg errors', async () => {
        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => {
                if (event === 'close') cb(8);
            }),
        });

        await expect(
            generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress)
        ).rejects.toThrow('FFmpeg exited with code 8 for 144p');
    });

    it('should handle missing audio tracks', async () => {
        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            audioTracks: [],
        });

        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(generateMasterPlaylist).toHaveBeenCalled();
    });

    it('should handle missing subtitle tracks', async () => {
        (getVideoInfo as any).mockResolvedValue({
            ...mockVideoInfo,
            subtitleTracks: [],
        });

        (spawn as any).mockReturnValue({
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: (code: number) => void) => { if (event === 'close') cb(0); }),
        });

        await generateHLS(mockInputPath, mockOutputDir, mockVideoId, mockOnProgress);

        expect(generateMasterPlaylist).toHaveBeenCalled();
    });
});