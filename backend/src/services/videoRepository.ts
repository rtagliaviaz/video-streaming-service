import { db } from './db';
import type { VideoMetadata } from './videoMetadata';
import type { AudioTrack, SubtitleTrack } from './ffmpeg/types';

interface VideoRow {
    id: string;
    original_name: string;
    created_at: string;
    duration: number;
    duration_formatted: string | null;
    size: number;
    qualities: string;
    audio_tracks: string;
    subtitle_tracks: string;
    job_id: string | null;
    status: string;
    error: string | null;
    kid: string | null;
    formats: string | null;
    updated_at: string;
}

function rowToVideo(row: VideoRow): VideoMetadata {
    return {
        id: row.id,
        originalName: row.original_name,
        createdAt: row.created_at,
        duration: row.duration,
        durationFormatted: row.duration_formatted ?? undefined,
        size: row.size,
        qualities: JSON.parse(row.qualities) as string[],
        audioTracks: JSON.parse(row.audio_tracks) as AudioTrack[],
        subtitleTracks: JSON.parse(row.subtitle_tracks) as SubtitleTrack[],
        jobId: row.job_id ?? undefined,
        status: row.status as VideoMetadata['status'],
        error: row.error ?? undefined,
        kid: row.kid ?? undefined,
        formats: row.formats ? (JSON.parse(row.formats) as ('hls' | 'dash')[]) : undefined,
    };
}

export function getVideo(id: string): VideoMetadata | null {
    const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRow | undefined;
    return row ? rowToVideo(row) : null;
}

export function getAllVideos(): VideoMetadata[] {
    const rows = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all() as VideoRow[];
    return rows.map(rowToVideo);
}

export function addOrUpdateVideo(metadata: VideoMetadata): void {
    db.prepare(`
        INSERT INTO videos (
            id, original_name, created_at, duration, duration_formatted,
            size, qualities, audio_tracks, subtitle_tracks, job_id,
            status, error, kid, formats, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            original_name = excluded.original_name,
            duration = excluded.duration,
            duration_formatted = excluded.duration_formatted,
            size = excluded.size,
            qualities = excluded.qualities,
            audio_tracks = excluded.audio_tracks,
            subtitle_tracks = excluded.subtitle_tracks,
            job_id = excluded.job_id,
            status = excluded.status,
            error = excluded.error,
            kid = excluded.kid,
            formats = excluded.formats,
            updated_at = excluded.updated_at
    `).run(
        metadata.id,
        metadata.originalName,
        metadata.createdAt,
        metadata.duration,
        metadata.durationFormatted ?? null,
        metadata.size,
        JSON.stringify(metadata.qualities ?? []),
        JSON.stringify(metadata.audioTracks ?? []),
        JSON.stringify(metadata.subtitleTracks ?? []),
        metadata.jobId ?? null,
        metadata.status ?? 'queued',
        metadata.error ?? null,
        metadata.kid ?? null,
        metadata.formats ? JSON.stringify(metadata.formats) : null,
        new Date().toISOString()
    );
}

export function deleteVideo(id: string): boolean {
    const result = db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    return result.changes > 0;
}

