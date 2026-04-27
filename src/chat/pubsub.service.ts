import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CMD } from '../redis/redis.tokens';
import { type ChatEventEnvelope, PUBSUB_CHANNEL } from './chat-events';

@Injectable()
export class ChatPubSub {
  constructor(@Inject(REDIS_CMD) private readonly redis: Redis) {}

  publish(envelope: ChatEventEnvelope): Promise<number> {
    return this.redis.publish(PUBSUB_CHANNEL, JSON.stringify(envelope));
  }
}
