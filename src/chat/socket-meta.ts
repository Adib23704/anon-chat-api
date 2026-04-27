import type { Redis } from 'ioredis';

export type SocketMeta = { userId: string; username: string; roomId: string };

const key = (id: string) => `sock:${id}`;

export const SocketMetaStore = {
  async set(redis: Redis, id: string, meta: SocketMeta): Promise<void> {
    await redis.hset(key(id), meta);
  },

  async get(redis: Redis, id: string): Promise<SocketMeta | null> {
    const obj = await redis.hgetall(key(id));
    if (!obj.userId || !obj.username || !obj.roomId) return null;
    return { userId: obj.userId, username: obj.username, roomId: obj.roomId };
  },

  async clear(redis: Redis, id: string): Promise<void> {
    await redis.del(key(id));
  },
};
