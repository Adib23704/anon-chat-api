import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_SUB } from '../redis/redis.tokens';
import { ChatGateway } from './chat.gateway';
import { type ChatEventEnvelope, PUBSUB_CHANNEL, ServerEvents } from './chat-events';

@Injectable()
export class PubSubBridge implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PubSubBridge.name);

  constructor(
    @Inject(REDIS_SUB) private readonly sub: Redis,
    private readonly gateway: ChatGateway,
  ) {}

  async onModuleInit() {
    await this.sub.subscribe(PUBSUB_CHANNEL);
    this.sub.on('message', (channel, raw) => {
      if (channel !== PUBSUB_CHANNEL) return;
      this.handle(raw).catch((err) => this.logger.error('pubsub handler failed', err as Error));
    });
  }

  async onApplicationShutdown() {
    try {
      await this.sub.unsubscribe(PUBSUB_CHANNEL);
    } catch {
      // ignore — connection may already be closing
    }
  }

  private async handle(raw: string) {
    const env = parse(raw);
    if (!env) return;

    const server = this.gateway.server;
    if (!server) return;

    if (env.type === 'message:new') {
      server.local.to(env.roomId).emit(ServerEvents.MessageNew, env.payload);
      return;
    }

    if (env.type === 'room:deleted') {
      server.local.to(env.roomId).emit(ServerEvents.RoomDeleted, env.payload);
      const sockets = await server.local.in(env.roomId).fetchSockets();
      for (const s of sockets) s.disconnect(true);
    }
  }
}

function parse(raw: string): ChatEventEnvelope | null {
  try {
    return JSON.parse(raw) as ChatEventEnvelope;
  } catch {
    return null;
  }
}
