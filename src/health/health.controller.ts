import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
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
  async check(@Res() res: Response) {
    const [dbOk, redisOk] = await Promise.all([this.pingDb(), this.pingRedis()]);
    const allOk = dbOk && redisOk;

    res.status(allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: allOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      redis: redisOk ? 'ok' : 'down',
    });
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
