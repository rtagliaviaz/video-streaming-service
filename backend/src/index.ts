import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes';
import { config, ensureDirectories } from './config';

dotenv.config();

const app = express();
const PORT = config.port;

ensureDirectories();

app.use(cors({
    // origin: '*',
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json());
app.use('/api', router);

// hls files
app.use('/hls', express.static(config.outputFolder));

// vtt files (subtitles)
app.use('/hls', express.static(config.outputFolder, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});