import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
  ...(isProduction && {
    redact: ['password', 'token', 'secret'],
  }),
});

export const createChildLogger = (bindings: Record<string, any>) => {
  return logger.child(bindings);
};

export default logger;