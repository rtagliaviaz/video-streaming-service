import path from 'path';
import fs from 'fs';
import { VideoMetadata, AudioTrack, SubtitleTrack } from './ffmpeg/types';
import { logger } from '../logger';

const METADATA_FILE = 'videos.json';

export class VideoMetadataService {
    private metadataPath: string;
    private videos: VideoMetadata[] = [];

    constructor(baseDir: string) {
        this.metadataPath = path.join(baseDir, METADATA_FILE);
        this.loadMetadata();
    }

    private loadMetadata(): void {
        try {
            if (fs.existsSync(this.metadataPath)) {
                const data = fs.readFileSync(this.metadataPath, 'utf-8');
                this.videos = JSON.parse(data);
                logger.info(`Loaded ${this.videos.length} videos from metadata`);
            } else {
                this.videos = [];
                logger.info('No previous metadata found');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Error loading metadata');
            this.videos = [];
        }
    }

    private saveMetadata(): void {
        try {
            fs.writeFileSync(this.metadataPath, JSON.stringify(this.videos, null, 2), 'utf-8');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Error saving metadata');
        }
    }

    addOrUpdateVideo(metadata: VideoMetadata): void {
        const index = this.videos.findIndex(v => v.id === metadata.id);
        if (index >= 0) {
            this.videos[index] = metadata;
        } else {
            this.videos.push(metadata);
        }
        this.saveMetadata();
    }

    getVideo(id: string): VideoMetadata | null {
        return this.videos.find(v => v.id === id) || null;
    }

    getAllVideos(): VideoMetadata[] {
        return [...this.videos].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    deleteVideo(id: string): boolean {
        const index = this.videos.findIndex(v => v.id === id);
        if (index >= 0) {
            this.videos.splice(index, 1);
            this.saveMetadata();
            return true;
        }
        return false;
    }

    static getOriginalName(filePath: string): string {
        const fileName = path.basename(filePath);
        const match = fileName.match(/^\d+-(.+)$/);
        return match ? match[1] : fileName;
    }
}