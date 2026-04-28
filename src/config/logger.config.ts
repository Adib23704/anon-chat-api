import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';

export function loggerConfig(): Params {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/health' },
      ...(isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', colorize: true },
            },
          }
        : {}),
      redact: { paths: ['req.headers.authorization'], censor: '[redacted]' },
      genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
      customProps: () => ({ service: 'anon-chat-api' }),
    },
  };
}
