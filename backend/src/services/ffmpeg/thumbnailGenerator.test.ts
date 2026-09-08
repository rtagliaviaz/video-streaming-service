import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateThumbnails } from './thumbnailGenerator';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../../logger';

// mock antes del vi.mock usando vi.hoisted()
const { mockFfmpegFn } = vi.hoisted(() => {
    const fn = vi.fn().mockImplementation((inputPath: string) => {
        const cmd: any = {
            screenshots: vi.fn().mockReturnThis(),
            on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                if (event === 'end') {
                    this._endCallback = callback;
                } else if (event === 'error') {
                    this._errorCallback = callback;
                }
                return this;
            }),
            _endCallback: null,
            _errorCallback: null,
        };
        return cmd;
    });

    // ffprobe como método estático
    (fn as any).ffprobe = vi.fn().mockImplementation(
        (inputPath: string, callback: (err: any, data: any) => void) => {
            setImmediate(() => {
                callback(null, { format: { duration: 120 } });
            });
        }
    );

    return { mockFfmpegFn: fn };
});

// ahora podemos usar mockFfmpegFn dentro del vi.mock
vi.mock('fluent-ffmpeg', () => ({
    default: mockFfmpegFn,
}));

// mocks de fs, path, child_process, logger
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        default: {
            existsSync: vi.fn(),
            mkdirSync: vi.fn(),
            readdirSync: vi.fn(),
            writeFileSync: vi.fn(),
            unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
    };
});

//basename para que devuelva el nombre del archivo
vi.mock('path', () => ({
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn(),
    basename: vi.fn((p: string) => p.split('/').pop() || ''),
    resolve: vi.fn(),
    default: {
        join: vi.fn((...args: string[]) => args.join('/')),
        dirname: vi.fn(),
        basename: vi.fn((p: string) => p.split('/').pop() || ''),
        resolve: vi.fn(),
    },
}));

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('../../logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('thumbnailGenerator', () => {
    const mockInputPath = '/fake/input.mp4';
    const mockOutputDir = '/fake/output';
    const mockVideoId = 'video_123';
    const numThumbnails = 40;

    //  para obtener el mock de ffmpeg con tipo any
    const getFfmpegMock = () => {
        return (mockFfmpegFn as any);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.existsSync as any).mockReturnValue(false);
        (fs.mkdirSync as any).mockReturnValue(undefined);
        (fs.readdirSync as any).mockReturnValue(
            Array.from({ length: numThumbnails }, (_, i) => `thumb_${String(i + 1).padStart(3, '0')}.jpg`)
        );
        (fs.writeFileSync as any).mockReturnValue(undefined);
        (fs.unlinkSync as any).mockReturnValue(undefined);
        (path.join as any).mockImplementation((...args: string[]) => args.join('/'));

        // spawn por default: sucess
        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        // ffprobe y ffmpeg mock
        const ffmpegMock = getFfmpegMock();
        ffmpegMock.ffprobe.mockImplementation(
            (inputPath: string, callback: (err: any, data: any) => void) => {
                setImmediate(() => {
                    callback(null, { format: { duration: 120 } });
                });
            }
        );
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockReturnThis(),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });
    });

    it('should create the thumbnails directory if it does not exist', async () => {
        (fs.existsSync as any).mockReturnValue(false);

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 5);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(fs.mkdirSync).toHaveBeenCalledWith(
            `${mockOutputDir}/${mockVideoId}/thumbnails`,
            { recursive: true }
        );
    });

    it('should not create directory if it already exists', async () => {
        (fs.existsSync as any).mockReturnValue(true);

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 5);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should call ffprobe to get video duration', async () => {
        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 5);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(ffmpegMock.ffprobe).toHaveBeenCalledWith(mockInputPath, expect.any(Function));
    });

    it('should handle ffprobe error', async () => {
        const ffmpegMock = getFfmpegMock();
        ffmpegMock.ffprobe.mockImplementationOnce(
            (inputPath: string, callback: (err: any, data: any) => void) => {
                setImmediate(() => {
                    callback(new Error('ffprobe error'), null);
                });
            }
        );

        await expect(
            generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails)
        ).rejects.toThrow('ffprobe error');

        expect(logger.error).toHaveBeenCalledWith(
            { error: 'ffprobe error' },
            'Error getting video duration for thumbnails'
        );
    });

    it('should handle video duration 0', async () => {
        const ffmpegMock = getFfmpegMock();
        ffmpegMock.ffprobe.mockImplementationOnce(
            (inputPath: string, callback: (err: any, data: any) => void) => {
                setImmediate(() => {
                    callback(null, { format: { duration: 0 } });
                });
            }
        );

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result).toEqual({
            thumbnails: [],
            sprite: '',
            vtt: ''
        });
        expect(logger.warn).toHaveBeenCalledWith('Video duration is 0, cannot generate thumbnails');
    });

    it('should generate individual thumbnails with screenshots', async () => {
        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.thumbnails.length).toBe(numThumbnails);
        // ahora path.basename devuelve el nombre correcto
        expect(result.thumbnails[0]).toContain('/api/thumbnails/video_123/thumb_001.jpg');
    });

    it('should generate sprite sheet and VTT on successful completion', async () => {
        (fs.readdirSync as any).mockReturnValue(
            Array.from({ length: numThumbnails }, (_, i) => `thumb_${String(i + 1).padStart(3, '0')}.jpg`)
        );

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.sprite).toBe('/api/thumbnails/video_123/sprite.jpg');
        expect(result.vtt).toBe('/api/thumbnails/video_123/thumbnails.vtt');
        expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        const vttCalls = (fs.writeFileSync as any).mock.calls.filter((call: any[]) => call[0].includes('thumbnails.vtt'));
        expect(vttCalls.length).toBe(1);
        const vttContent = vttCalls[0][1];
        expect(vttContent).toContain('WEBVTT');
        expect(vttContent).toContain('sprite.jpg#xywh=');
    });

    it('should handle sprite generation failure', async () => {
        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(1), 10);
                    }
                }),
            };
            return proc;
        });

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.sprite).toBe('');
        expect(result.vtt).toBe('');
        expect(logger.error).toHaveBeenCalledWith(
            { code: 1, stderr: '' },
            'Error generating sprite'
        );
    });

    it('should handle error during individual thumbnail generation', async () => {
        const ffmpegMock = getFfmpegMock();
        let callCount = 0;
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    if (callCount === 0) {
                        setTimeout(() => {
                            if (this._errorCallback) this._errorCallback(new Error('screenshot error'));
                        }, 2);
                    } else {
                        setTimeout(() => {
                            if (this._endCallback) this._endCallback();
                        }, 2);
                    }
                    callCount++;
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.thumbnails.length).toBe(numThumbnails);
        expect(logger.warn).toHaveBeenCalledWith(
            { error: 'screenshot error', index: 0 },
            'Error generating thumbnail 0'
        );
        expect(result.sprite).toBe('/api/thumbnails/video_123/sprite.jpg');
    });

    it('should generate VTT with correct coordinates', async () => {
        (fs.readdirSync as any).mockReturnValue(
            Array.from({ length: numThumbnails }, (_, i) => `thumb_${String(i + 1).padStart(3, '0')}.jpg`)
        );

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        const vttCalls = (fs.writeFileSync as any).mock.calls.filter((call: any[]) => call[0].includes('thumbnails.vtt'));
        expect(vttCalls.length).toBe(1);
        const vttContent = vttCalls[0][1];
        const lines = vttContent.split('\n');
        const entries = lines.filter((line: string) => line.includes('sprite.jpg#xywh='));
        expect(entries.length).toBe(numThumbnails);
        expect(entries[0]).toContain('#xywh=4,4,160,90');
        const last = entries[entries.length - 1];
        const row = Math.floor((numThumbnails - 1) / 8);
        const col = (numThumbnails - 1) % 8;
        const expectedX = col * (160 + 4) + 4;
        const expectedY = row * (90 + 4) + 4;
        expect(last).toContain(`#xywh=${expectedX},${expectedY},160,90`);
    });

    it('should handle Windows file list creation for sprite', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        const listFileCalls = (fs.writeFileSync as any).mock.calls.filter((call: any[]) => call[0].includes('files.txt'));
        expect(listFileCalls.length).toBe(1);
        expect(spawn).toHaveBeenCalledWith(
            'ffmpeg',
            expect.arrayContaining(['-f', 'concat']),
            { windowsHide: true }
        );
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle error creating file list on Windows', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        (fs.writeFileSync as any).mockImplementationOnce(() => {
            throw new Error('write error');
        });

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.thumbnails.length).toBe(numThumbnails);
        expect(result.sprite).toBe('');
        expect(result.vtt).toBe('');
        expect(logger.error).toHaveBeenCalledWith(
            { error: expect.any(Error) },
            'Error creating file list for sprite'
        );

        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should clean up list file on Windows after sprite generation', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'close') {
                        setTimeout(() => cb(0), 10);
                    }
                }),
            };
            return proc;
        });

        // forzar que existsSync devuelva true para que se ejecute unlinkSync
        (fs.existsSync as any).mockReturnValue(true);

        await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('files.txt'));

        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle sprite spawn error', async () => {
        (spawn as any).mockImplementation(() => {
            const proc: any = {
                stderr: { on: vi.fn() },
                on: vi.fn((event: string, cb: Function) => {
                    if (event === 'error') {
                        setTimeout(() => cb(new Error('spawn error')), 5);
                    }
                }),
            };
            return proc;
        });

        const ffmpegMock = getFfmpegMock();
        ffmpegMock.mockImplementation((inputPath: string) => {
            const cmd: any = {
                screenshots: vi.fn().mockImplementation(function (this: any, options: any) {
                    setTimeout(() => {
                        if (this._endCallback) this._endCallback();
                    }, 2);
                    return this;
                }),
                on: vi.fn().mockImplementation(function (this: any, event: string, callback: Function) {
                    if (event === 'end') {
                        this._endCallback = callback;
                    } else if (event === 'error') {
                        this._errorCallback = callback;
                    }
                    return this;
                }),
                _endCallback: null,
                _errorCallback: null,
            };
            return cmd;
        });

        const result = await generateThumbnails(mockInputPath, mockOutputDir, mockVideoId, numThumbnails);
        expect(result.sprite).toBe('');
        expect(result.vtt).toBe('');
        expect(logger.error).toHaveBeenCalledWith(
            { error: 'spawn error' },
            'Sprite generation error'
        );
    });
});