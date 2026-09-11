import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import router from './routes';
import { config, ensureDirectories } from './config';

dotenv.config();

const app = express();

ensureDirectories();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json());

app.use('/hls', express.static(config.outputFolder, {
    setHeaders: (res, filePath) => {
        const lower = filePath.toLowerCase();

        if (lower.endsWith('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return;
        }

        if (lower.endsWith('.m4s') || lower.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }

        if (lower.endsWith('.ts')) {
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }

        if (lower.endsWith('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }

        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }

        if (lower.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }
    },
}));

app.use('/api', router);

export { app };