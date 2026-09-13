import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { Public } from '../common/public.decorator';
import { type Db, DRIZZLE } from '../database/database.providers';
import { REDIS_CMD } from '../redis/redis.tokens';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REDIS_CMD) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check verifying PostgreSQL and Redis connections' })
  @ApiResponse({ status: 200, description: 'Service and all dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more backing services are unreachable' })
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
