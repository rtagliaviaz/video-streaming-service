import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';
import { ensureDirectories } from './config';

dotenv.config();

const app = express();

ensureDirectories();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json());

app.use('/api', router);

export { app };