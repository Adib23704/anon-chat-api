import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CMD } from '../redis/redis.tokens';

const presenceKey = (roomId: string) => `room:${roomId}:presence`;

export type JoinResult = { isNewUser: boolean; activeUsers: string[] };
export type LeaveResult = { isLastConnection: boolean; activeUsers: string[] };

@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CMD) private readonly redis: Redis) {}

  async join(roomId: string, username: string): Promise<JoinResult> {
    const count = await this.redis.hincrby(presenceKey(roomId), username, 1);
    const activeUsers = await this.redis.hkeys(presenceKey(roomId));
    return { isNewUser: count === 1, activeUsers };
  }

  async leave(roomId: string, username: string): Promise<LeaveResult> {
    const count = await this.redis.hincrby(presenceKey(roomId), username, -1);
    let isLastConnection = false;
    if (count <= 0) {
      await this.redis.hdel(presenceKey(roomId), username);
      isLastConnection = true;
    }
    const activeUsers = await this.redis.hkeys(presenceKey(roomId));
    return { isLastConnection, activeUsers };
  }

  count(roomId: string): Promise<number> {
    return this.redis.hlen(presenceKey(roomId));
  }

  members(roomId: string): Promise<string[]> {
    return this.redis.hkeys(presenceKey(roomId));
  }

  async clear(roomId: string): Promise<void> {
    await this.redis.del(presenceKey(roomId));
  }
}
