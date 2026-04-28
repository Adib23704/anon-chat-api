import type { FactoryProvider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../config/config.service';
import { REDIS_CMD, REDIS_SUB } from './redis.tokens';

const cmdOpts = {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  connectTimeout: 5_000,
  enableOfflineQueue: false,
} as const;

const subOpts = {
  maxRetriesPerRequest: null,
  lazyConnect: false,
  connectTimeout: 5_000,
  enableOfflineQueue: true,
} as const;

function attachErrorLogger(client: Redis, label: string): Redis {
  const logger = new Logger(`Redis:${label}`);
  client.on('error', (err) => logger.warn(err.message));
  return client;
}

export const redisCmdProvider: FactoryProvider = {
  provide: REDIS_CMD,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) =>
    attachErrorLogger(new Redis(config.env.REDIS_URL, cmdOpts), 'cmd'),
};

export const redisSubProvider: FactoryProvider = {
  provide: REDIS_SUB,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) =>
    attachErrorLogger(new Redis(config.env.REDIS_URL, subOpts), 'sub'),
};
