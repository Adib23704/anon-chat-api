import { Injectable } from '@nestjs/common';
import { type Env, envSchema } from './env.schema';

@Injectable()
export class AppConfigService {
  readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    this.env = parsed.data;
  }
}
