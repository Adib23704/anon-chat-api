import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AppConfigService } from '../config/config.service';
import { REDIS_CMD } from '../redis/redis.tokens';

const sessionKey = (token: string) => `session:${token}`;

@Injectable()
export class SessionService {
  constructor(
    @Inject(REDIS_CMD) private readonly redis: Redis,
    private readonly config: AppConfigService,
  ) {}

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(sessionKey(token), userId, 'EX', this.config.env.SESSION_TTL_SECONDS);
    return token;
  }

  resolve(token: string): Promise<string | null> {
    return this.redis.get(sessionKey(token));
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(sessionKey(token));
  }
}
