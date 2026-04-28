import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AuthGuard } from './common/auth.guard';
import { AppConfigModule } from './config/config.module';
import { loggerConfig } from './config/logger.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';
import { PresenceModule } from './presence/presence.module';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    LoggerModule.forRoot(loggerConfig()),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: process.env.NODE_ENV === 'test' ? 100_000 : 60 },
    ]),
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    PresenceModule,
    RoomsModule,
    MessagesModule,
    ChatModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
