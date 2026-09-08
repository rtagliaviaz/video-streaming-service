import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
app.use('/api', router);

// HLS files
app.use('/hls', express.static(config.outputFolder));

// VTT files (subtitles)
app.use('/hls', express.static(config.outputFolder, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

export { app };