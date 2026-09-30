import path from 'path';
import { app } from './app';
import { config } from './config';
import { logger } from './logger';
import { initDatabase } from './services/db';

initDatabase();

const PORT = config.port;

app.listen(PORT, () => {
    logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});

export { app };