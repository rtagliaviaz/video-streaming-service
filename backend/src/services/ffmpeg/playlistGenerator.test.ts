import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMasterPlaylist } from './playlistGenerator';
import { QualityProfile, AudioTrack, SubtitleTrack } from './types';
import fs from 'fs';
import path from 'path';
import { logger } from '../../logger';

//  fs con default y named exports
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

// sin importOriginal para evitar errores de tipo
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

    beforeEach(() => {
        vi.clearAllMocks();
        (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    });

    it('should write the master playlist to the correct path', () => {
        generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            `${mockOutputPath}/index.m3u8`,
            expect.any(String)
        );
    });

    it('should include #EXTM3U and #EXT-X-VERSION:6 headers', () => {
        generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
        const playlist = (fs.writeFileSync as any).mock.calls[0][1];
        expect(playlist).toContain('#EXTM3U');
        expect(playlist).toContain('#EXT-X-VERSION:6');
    });

    describe('audio tracks', () => {
        it('should include #EXT-X-MEDIA for each audio track', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, []);
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
            generateMasterPlaylist(mockOutputPath, mockQualities, audioWithoutLanguage, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="track1"');
            expect(playlist).toContain('NAME="Audio 1"');
        });

        it('should include AUDIO attribute in #EXT-X-STREAM-INF when audio exists', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('AUDIO="audio-group"');
        });

        it('should NOT include AUDIO attribute when no audio tracks exist', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).not.toContain('AUDIO="audio-group"');
        });

        it('should include all qualities with audio group when audio exists', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            const sortedQualities = [...mockQualities].sort((a, b) => a.height - b.height);
            sortedQualities.forEach(quality => {
                const expected = `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(quality.bitrate) * 1000},RESOLUTION=${quality.resolution},NAME="${quality.name}",AUDIO="audio-group",FRAME-RATE=30.000`;
                expect(playlist).toContain(expected);
                expect(playlist).toContain(`playlist_${quality.name}.m3u8`);
            });
        });

        it('should include all qualities without audio group when no audio exists', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            const sortedQualities = [...mockQualities].sort((a, b) => a.height - b.height);
            sortedQualities.forEach(quality => {
                const expected = `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(quality.bitrate) * 1000},RESOLUTION=${quality.resolution},NAME="${quality.name}",FRAME-RATE=30.000`;
                expect(playlist).toContain(expected);
                expect(playlist).toContain(`playlist_${quality.name}.m3u8`);
            });
        });
    });

    describe('subtitle tracks', () => {
        it('should include #EXT-X-MEDIA for each subtitle track', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], mockSubtitleTracks);
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
            generateMasterPlaylist(mockOutputPath, mockQualities, [], subtitleWithoutLanguage);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="sub1"');
            expect(playlist).toContain('NAME="Subtitle 1"');
        });

        it('should include subtitle section header when subtitles exist', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], mockSubtitleTracks);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('# === SUBTITLES (WebVTT) ===');
        });

        it('should NOT include subtitle section header when no subtitles exist', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
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
            generateMasterPlaylist(mockOutputPath, unsortedQualities, [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1] as string;
            const lines = playlist.split('\n');
            const streamInfLines = lines.filter((line: string) => line.includes('#EXT-X-STREAM-INF'));
            expect(streamInfLines[0]).toContain('RESOLUTION=640x360');
            expect(streamInfLines[1]).toContain('RESOLUTION=1280x720');
            expect(streamInfLines[2]).toContain('RESOLUTION=1920x1080');
        });
    });

    describe('bandwidth calculation', () => {
        it('should calculate bandwidth as bitrate * 1000', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            mockQualities.forEach(quality => {
                const expectedBandwidth = parseInt(quality.bitrate) * 1000;
                expect(playlist).toContain(`BANDWIDTH=${expectedBandwidth}`);
            });
        });
    });

    describe('logging', () => {
        it('should log info with quality, audio, and subtitle counts', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, mockSubtitleTracks);
            expect(logger.info).toHaveBeenCalledWith(
                `Master playlist created with ${mockQualities.length} qualities, ${mockAudioTracks.length} audio tracks, ${mockSubtitleTracks.length} subtitle tracks`
            );
        });

        it('should log debug for each audio track', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, []);
            expect(logger.debug).toHaveBeenCalledTimes(mockAudioTracks.length);
            mockAudioTracks.forEach((track, i) => {
                expect(logger.debug).toHaveBeenCalledWith(
                    { audioIndex: i, language: track.language, codec: track.codec },
                    `Audio ${i + 1}: ${track.language} (${track.codec})`
                );
            });
        });

        it('should log debug for each subtitle track', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, [], mockSubtitleTracks);
            expect(logger.debug).toHaveBeenCalledTimes(mockSubtitleTracks.length);
            mockSubtitleTracks.forEach((track, i) => {
                expect(logger.debug).toHaveBeenCalledWith(
                    { subtitleIndex: i, language: track.language, codec: track.codec },
                    `Subtitle ${i + 1}: ${track.language} (${track.codec})`
                );
            });
        });
    });

    describe('edge cases', () => {
        it('should handle empty qualities array gracefully', () => {
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
            generateMasterPlaylist(mockOutputPath, mockQualities, minimalAudio, []);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="track1"');
            expect(playlist).toContain('NAME="Audio 1"');
        });

        it('should handle subtitle tracks with no language or title', () => {
            const minimalSubtitle: SubtitleTrack[] = [
                { index: 0, codec: 'webvtt' },
            ];
            generateMasterPlaylist(mockOutputPath, mockQualities, [], minimalSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('LANGUAGE="sub1"');
            expect(playlist).toContain('NAME="Subtitle 1"');
        });

        it('should handle subtitles with default flag false', () => {
            const nonDefaultSubtitle: SubtitleTrack[] = [
                { index: 0, language: 'eng', codec: 'webvtt', title: 'English', default: false },
            ];
            generateMasterPlaylist(mockOutputPath, mockQualities, [], nonDefaultSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('DEFAULT=NO');
        });

        it('should handle subtitles with default flag true', () => {
            const defaultSubtitle: SubtitleTrack[] = [
                { index: 0, language: 'eng', codec: 'webvtt', title: 'English', default: true },
            ];
            generateMasterPlaylist(mockOutputPath, mockQualities, [], defaultSubtitle);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('DEFAULT=YES');
        });

        it('should include both audio and subtitles when both exist', () => {
            generateMasterPlaylist(mockOutputPath, mockQualities, mockAudioTracks, mockSubtitleTracks);
            const playlist = (fs.writeFileSync as any).mock.calls[0][1];
            expect(playlist).toContain('TYPE=AUDIO');
            expect(playlist).toContain('TYPE=SUBTITLES');
            expect(playlist).toContain('AUDIO="audio-group"');
            expect(playlist).toContain('GROUP-ID="subs"');
        });
    });
});