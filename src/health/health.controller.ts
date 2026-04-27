import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { type Db, DRIZZLE } from '../database/database.providers';
import { REDIS_CMD } from '../redis/redis.tokens';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REDIS_CMD) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([this.pingDb(), this.pingRedis()]);

    if (!dbOk || !redisOk) {
      throw new HttpException(
        { status: 'degraded', db: dbOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', db: 'ok', redis: 'ok' };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }
}
