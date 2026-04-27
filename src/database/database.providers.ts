import type { FactoryProvider } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppConfigService } from '../config/config.service';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_CLIENT = Symbol('PG_CLIENT');

export type Db = PostgresJsDatabase<typeof schema>;
export type PgClient = ReturnType<typeof postgres>;

export const pgClientProvider: FactoryProvider = {
  provide: PG_CLIENT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) =>
    postgres(config.env.DATABASE_URL, {
      max: 10,
      prepare: false,
      connect_timeout: 5,
      idle_timeout: 30,
    }),
};

export const drizzleProvider: FactoryProvider = {
  provide: DRIZZLE,
  inject: [PG_CLIENT],
  useFactory: (client: PgClient) => drizzle(client, { schema }),
};
