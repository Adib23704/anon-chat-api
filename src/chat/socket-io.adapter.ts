import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { REDIS_CMD, REDIS_SUB } from '../redis/redis.tokens';

export class RedisIoAdapter extends IoAdapter {
  private adapterCmd?: Redis;
  private adapterSub?: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    const cmd = this.app.get<Redis>(REDIS_CMD);
    const sub = this.app.get<Redis>(REDIS_SUB);

    this.adapterCmd = cmd.duplicate({ enableOfflineQueue: true });
    this.adapterSub = sub.duplicate({ enableOfflineQueue: true });

    server.adapter(createAdapter(this.adapterCmd, this.adapterSub));
    return server;
  }

  async dispose(): Promise<void> {
    this.adapterCmd?.disconnect();
    this.adapterSub?.disconnect();
    await super.dispose();
  }

  async close(server: Server): Promise<void> {
    this.dispose();
    await super.close(server);
  }
}
