import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  DRIZZLE,
  drizzleProvider,
  PG_CLIENT,
  type PgClient,
  pgClientProvider,
} from './database.providers';

@Global()
@Module({
  providers: [pgClientProvider, drizzleProvider],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: PgClient) {}

  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
