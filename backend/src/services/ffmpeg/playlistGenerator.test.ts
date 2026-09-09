import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMasterPlaylist } from './playlistGenerator';
import { QualityProfile, AudioTrack, SubtitleTrack, CodecVariant } from './types';
import fs from 'fs';
import path from 'path';
import { logger } from '../../logger';

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        default: {
            writeFileSync: vi.fn(),
            existsSync: vi.fn(),
            mkdirSync: vi.fn(),
            readdirSync: vi.fn(),
            statSync: vi.fn(),
            unlinkSync: vi.fn(),
            rmSync: vi.fn(),
        },
        writeFileSync: vi.fn(),
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        unlinkSync: vi.fn(),
        rmSync: vi.fn(),
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

vi.mock('../../logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('playlistGenerator', () => {
    const mockOutputPath = '/fake/output/video_123';

    const mockQualities: QualityProfile[] = [
        { name: '144p', resolution: '256x144', bitrate: '100', maxrate: '150', bufsize: '200', height: 144, width: 256 },
        { name: '240p', resolution: '426x240', bitrate: '200', maxrate: '300', bufsize: '400', height: 240, width: 426 },
        { name: '360p', resolution: '640x360', bitrate: '400', maxrate: '600', bufsize: '800', height: 360, width: 640 },
    ];

    const mockAudioTracks: AudioTrack[] = [
        { index: 0, language: 'eng', codec: 'aac', channels: 2, sampleRate: 48000, title: 'English' },
        { index: 1, language: 'spa', codec: 'aac', channels: 2, sampleRate: 48000, title: 'Spanish' },
    ];

    const mockSubtitleTracks: SubtitleTrack[] = [
        { index: 0, language: 'eng', codec: 'webvtt', title: 'English Subtitles', default: true },
        { index: 1, language: 'spa', codec: 'webvtt', title: 'Spanish Subtitles', default: false },
    ];

    const createCodecVariant = (codecName: string, encoder: string, qualities: QualityProfile[]): CodecVariant => ({
        encoder,
        codecName,
        playlistPrefix: `playlist_${codecName}`,
        segmentPrefix: `segment_${codecName}`,
        initPrefix: `init_${codecName}`,
        qualities,
        masterPlaylist: path.join(mockOutputPath, `${codecName}.m3u8`),
    });

    const mockH264Variant = createCodecVariant('h264', 'libx264', mockQualities);

    beforeEach(() => {
        vi.clearAllMocks();
        (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    });

    it('should write the master playlist to the correct path', () => {
        generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            `${mockOutputPath}/index.m3u8`,
            expect.any(String)
        );
    });

    it('should include #EXTM3U and #EXT-X-VERSION:6 headers', () => {
        generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
        const playlist = (fs.writeFileSync as any).mock.calls[0][1];
        expect(playlist).toContain('#EXTM3U');
        expect(playlist).toContain('#EXT-X-VERSION:6');
    });

    describe('audio tracks', () => {
        it('should include #EXT-X-MEDIA for each audio track', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], mockAudioTracks, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockAudioTracks.forEach((track, index) => {
                const expected = `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-group",LANGUAGE="${track.language}",NAME="${track.title}",DEFAULT=${index === 0 ? 'YES' : 'NO'},AUTOSELECT=YES,URI="audio_${index}.m3u8"`;
                expect(playlist).toContain(expected);
            });
        });

        it('should use fallback values when language or title is missing', () => {
            const audioWithoutLanguage: AudioTrack[] = [
                { index: 0, codec: 'aac', channels: 2, sampleRate: 48000 },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], audioWithoutLanguage, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="track1"');
            expect(playlist).toContain('NAME="Audio 1"');
        });

        it('should include AUDIO attribute in #EXT-X-STREAM-INF when audio exists', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], mockAudioTracks, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('AUDIO="audio-group"');
        });

        it('should NOT include AUDIO attribute when no audio tracks exist', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).not.toContain('AUDIO="audio-group"');
        });

        it('should include all qualities with audio group when audio exists', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], mockAudioTracks, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            const sortedQualities = [...mockQualities].sort((a, b) => a.height - b.height);
            sortedQualities.forEach(quality => {
                const expected = `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(quality.bitrate) * 1000},RESOLUTION=${quality.resolution},NAME="${quality.name} (H264)",CODECS="avc1.640028",AUDIO="audio-group"`;
                expect(playlist).toContain(expected);
                expect(playlist).toContain(`playlist_h264_${quality.name}.m3u8`);
            });
        });

        it('should include all qualities without audio group when no audio exists', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            const sortedQualities = [...mockQualities].sort((a, b) => a.height - b.height);
            sortedQualities.forEach(quality => {
                const expected = `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(quality.bitrate) * 1000},RESOLUTION=${quality.resolution},NAME="${quality.name} (H264)",CODECS="avc1.640028"`;
                expect(playlist).toContain(expected);
                expect(playlist).toContain(`playlist_h264_${quality.name}.m3u8`);
            });
        });
    });

    describe('subtitle tracks', () => {
        it('should include #EXT-X-MEDIA for each subtitle track', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], mockSubtitleTracks);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockSubtitleTracks.forEach((track, index) => {
                const isDefault = track.default ? 'YES' : 'NO';
                const expected = `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="${track.language}",NAME="${track.title}",DEFAULT=${isDefault},AUTOSELECT=YES,URI="subtitle_${index}.vtt"`;
                expect(playlist).toContain(expected);
            });
        });

        it('should use fallback values when subtitle language or title is missing', () => {
            const subtitleWithoutLanguage: SubtitleTrack[] = [
                { index: 0, codec: 'webvtt' },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], subtitleWithoutLanguage);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="sub1"');
            expect(playlist).toContain('NAME="Subtitle 1"');
        });

        it('should include SUBTITLES attribute in #EXT-X-STREAM-INF when subtitles exist', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], mockSubtitleTracks);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('SUBTITLES="subs"');
        });

        it('should NOT include subtitle section header when no subtitles exist', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).not.toContain('# === SUBTITLES (WebVTT) ===');
        });
    });

    describe('quality sorting', () => {
        it('should sort qualities by height (ascending)', () => {
            const unsortedQualities: QualityProfile[] = [
                { name: '1080p', resolution: '1920x1080', bitrate: '4000', maxrate: '6000', bufsize: '8000', height: 1080, width: 1920 },
                { name: '360p', resolution: '640x360', bitrate: '400', maxrate: '600', bufsize: '800', height: 360, width: 640 },
                { name: '720p', resolution: '1280x720', bitrate: '2000', maxrate: '3000', bufsize: '4000', height: 720, width: 1280 },
            ];
            const variant = createCodecVariant('h264', 'libx264', unsortedQualities);
            generateMasterPlaylist(mockOutputPath, [variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1] as string;
            const lines = playlist.split('\n');
            const streamInfLines = lines.filter((line: string) => line.includes('#EXT-X-STREAM-INF'));
            expect(streamInfLines[0]).toContain('RESOLUTION=640x360');
            expect(streamInfLines[1]).toContain('RESOLUTION=1280x720');
            expect(streamInfLines[2]).toContain('RESOLUTION=1920x1080');
        });
    });

    describe('bandwidth calculation', () => {
        it('should calculate bandwidth as bitrate * 1000 for H.264', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockQualities.forEach(quality => {
                const expectedBandwidth = parseInt(quality.bitrate) * 1000;
                expect(playlist).toContain(`BANDWIDTH=${expectedBandwidth}`);
            });
        });

        it('should adjust bandwidth for HEVC (70% of H.264)', () => {
            const hevcVariant = createCodecVariant('hevc', 'hevc_nvenc', mockQualities);
            generateMasterPlaylist(mockOutputPath, [hevcVariant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockQualities.forEach(quality => {
                const h264Bandwidth = parseInt(quality.bitrate) * 1000;
                const expectedBandwidth = Math.round(h264Bandwidth * 0.7);
                expect(playlist).toContain(`BANDWIDTH=${expectedBandwidth}`);
            });
        });

        it('should include CODECS attribute for H.264', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('CODECS="avc1.640028"');
        });

        it('should include CODECS attribute for HEVC', () => {
            const hevcVariant = createCodecVariant('hevc', 'hevc_nvenc', mockQualities);
            generateMasterPlaylist(mockOutputPath, [hevcVariant], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('CODECS="hvc1.1.6.L123.0"');
        });

        it('should handle multiple codec variants in the same playlist', () => {
            const hevcVariant = createCodecVariant('hevc', 'hevc_nvenc', mockQualities);
            const variants = [mockH264Variant, hevcVariant];
            generateMasterPlaylist(mockOutputPath, variants, [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockQualities.forEach(quality => {
                expect(playlist).toContain(`playlist_h264_${quality.name}.m3u8`);
                expect(playlist).toContain(`playlist_hevc_${quality.name}.m3u8`);
                // Verificar que HEVC tenga CODECS correcto
                expect(playlist).toContain('CODECS="hvc1.1.6.L123.0"');
                expect(playlist).toContain('CODECS="avc1.640028"');
            });
        });
    });

    describe('logging', () => {
        it('should log info with codec variants, audio, and subtitle counts', () => {
            const hevcVariant = createCodecVariant('hevc', 'hevc_nvenc', mockQualities);
            const variants = [mockH264Variant, hevcVariant];
            generateMasterPlaylist(mockOutputPath, variants, mockAudioTracks, mockSubtitleTracks);
            expect(logger.info).toHaveBeenCalledWith(`Master playlist created with ${variants.length} codec variants`);
            expect(logger.info).toHaveBeenCalledWith(`  - H264: ${mockQualities.length} qualities (encoder: libx264)`);
            expect(logger.info).toHaveBeenCalledWith(`  - HEVC: ${mockQualities.length} qualities (encoder: hevc_nvenc)`);
            expect(logger.info).toHaveBeenCalledWith(`  - ${mockAudioTracks.length} audio tracks, ${mockSubtitleTracks.length} subtitle tracks`);
        });

        it('should NOT log debug for audio tracks (removed from implementation)', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], mockAudioTracks, []);
            expect(logger.debug).not.toHaveBeenCalled();
        });

        it('should NOT log debug for subtitle tracks (removed from implementation)', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], mockSubtitleTracks);
            expect(logger.debug).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle empty codec variants array gracefully', () => {
            generateMasterPlaylist(mockOutputPath, [], [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('#EXTM3U');
            expect(playlist).toContain('#EXT-X-VERSION:6');
            expect(playlist).not.toContain('#EXT-X-STREAM-INF');
        });

        it('should handle audio tracks with no language or title', () => {
            const minimalAudio: AudioTrack[] = [
                { index: 0, codec: 'aac', channels: 2, sampleRate: 48000 },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], minimalAudio, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="track1"');
            expect(playlist).toContain('NAME="Audio 1"');
        });

        it('should handle subtitle tracks with no language or title', () => {
            const minimalSubtitle: SubtitleTrack[] = [
                { index: 0, codec: 'webvtt' },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], minimalSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="sub1"');
            expect(playlist).toContain('NAME="Subtitle 1"');
        });

        it('should handle subtitles with default flag false', () => {
            const nonDefaultSubtitle: SubtitleTrack[] = [
                { index: 0, language: 'eng', codec: 'webvtt', title: 'English', default: false },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], nonDefaultSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('DEFAULT=NO');
        });

        it('should handle subtitles with default flag true', () => {
            const defaultSubtitle: SubtitleTrack[] = [
                { index: 0, language: 'eng', codec: 'webvtt', title: 'English', default: true },
            ];
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], [], defaultSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('DEFAULT=YES');
        });

        it('should include both audio and subtitles when both exist', () => {
            generateMasterPlaylist(mockOutputPath, [mockH264Variant], mockAudioTracks, mockSubtitleTracks);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('TYPE=AUDIO');
            expect(playlist).toContain('TYPE=SUBTITLES');
            expect(playlist).toContain('AUDIO="audio-group"');
            expect(playlist).toContain('SUBTITLES="subs"');
        });
    });
});