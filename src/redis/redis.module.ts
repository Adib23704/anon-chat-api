import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { redisCmdProvider, redisSubProvider } from './redis.providers';
import { REDIS_CMD, REDIS_SUB } from './redis.tokens';

@Global()
@Module({
  providers: [redisCmdProvider, redisSubProvider],
  exports: [REDIS_CMD, REDIS_SUB],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CMD) private readonly cmd: Redis,
    @Inject(REDIS_SUB) private readonly sub: Redis,
  ) {}

  async onApplicationShutdown() {
    await Promise.allSettled([this.cmd.quit(), this.sub.quit()]);
  }
}
