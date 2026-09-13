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
    const key = presenceKey(roomId);
    const results = await this.redis.pipeline().hincrby(key, username, 1).hkeys(key).exec();
    const count = (results?.[0]?.[1] as number) ?? 1;
    const activeUsers = (results?.[1]?.[1] as string[]) ?? [];
    return { isNewUser: count === 1, activeUsers };
  }

  async leave(roomId: string, username: string): Promise<LeaveResult> {
    const key = presenceKey(roomId);
    const count = await this.redis.hincrby(key, username, -1);
    let isLastConnection = false;
    if (count <= 0) {
      isLastConnection = true;
      const results = await this.redis.pipeline().hdel(key, username).hkeys(key).exec();
      const activeUsers = (results?.[1]?.[1] as string[]) ?? [];
      return { isLastConnection, activeUsers };
    }
    const activeUsers = await this.redis.hkeys(key);
    return { isLastConnection, activeUsers };
  }

  count(roomId: string): Promise<number> {
    return this.redis.hlen(presenceKey(roomId));
  }

  async countBatch(roomIds: string[]): Promise<number[]> {
    if (roomIds.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of roomIds) {
      pipeline.hlen(presenceKey(id));
    }
    const results = await pipeline.exec();
    if (!results) return roomIds.map(() => 0);
    return results.map(([err, count]) => (err ? 0 : Number(count ?? 0)));
  }

  async clear(roomId: string): Promise<void> {
    await this.redis.del(presenceKey(roomId));
  }
}
