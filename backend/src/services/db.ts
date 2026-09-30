import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../logger';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'videos.db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            original_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            duration REAL NOT NULL,
            duration_formatted TEXT,
            size INTEGER NOT NULL,
            qualities TEXT NOT NULL,
            audio_tracks TEXT NOT NULL,
            subtitle_tracks TEXT NOT NULL,
            job_id TEXT,
            status TEXT NOT NULL DEFAULT 'queued',
            error TEXT,
            kid TEXT,
            formats TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
        CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_videos_job_id ON videos(job_id);
    `);
    logger.info(`[db] SQLite ready at ${DB_PATH}`);
}

export function getDatabasePath(): string {
    return DB_PATH;
}