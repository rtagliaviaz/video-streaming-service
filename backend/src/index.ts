import { app } from './app';
import { config } from './config';
import { logger } from './logger';

const PORT = config.port;

app.listen(PORT, () => {
    logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});

export { app };