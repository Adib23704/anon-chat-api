import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { newUserId } from '../common/id-generator';
import { type Db, DRIZZLE } from '../database/database.providers';
import { users } from '../database/schema';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly sessions: SessionService,
  ) {}

  async login(username: string) {
    const [user] = await this.db
      .insert(users)
      .values({ id: newUserId(), username })
      .onConflictDoUpdate({
        target: users.username,
        set: { username: sql`excluded.username` },
      })
      .returning();

    const token = await this.sessions.issue(user.id);

    return {
      sessionToken: token,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}
