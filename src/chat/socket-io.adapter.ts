import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { REDIS_CMD, REDIS_SUB } from '../redis/redis.tokens';

export class RedisIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    const cmd = this.app.get<Redis>(REDIS_CMD);
    const sub = this.app.get<Redis>(REDIS_SUB);

    const adapterCmd = cmd.duplicate({ enableOfflineQueue: true });
    const adapterSub = sub.duplicate({ enableOfflineQueue: true });

    server.adapter(createAdapter(adapterCmd, adapterSub));
    return server;
  }
}
