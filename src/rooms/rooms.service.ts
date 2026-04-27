import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  ForbiddenException,
  RoomNameTakenException,
  RoomNotFoundException,
} from '../common/exceptions';
import { newRoomId } from '../common/id-generator';
import { type Db, DRIZZLE } from '../database/database.providers';
import { rooms, users } from '../database/schema';
import { PresenceService } from '../presence/presence.service';

export type RoomSummary = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type RoomDetail = RoomSummary & { activeUsers: number };

@Injectable()
export class RoomsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly presence: PresenceService,
  ) {}

  async list(): Promise<RoomDetail[]> {
    const rows = await this.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdAt: rooms.createdAt,
        creatorUsername: users.username,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .orderBy(desc(rooms.createdAt));

    const counts = await Promise.all(rows.map((r) => this.presence.count(r.id)));

    return rows.map((r, i) => ({
      id: r.id,
      name: r.name,
      createdBy: r.creatorUsername,
      activeUsers: counts[i],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(name: string, creatorId: string, creatorUsername: string): Promise<RoomSummary> {
    try {
      const [row] = await this.db
        .insert(rooms)
        .values({ id: newRoomId(), name, createdById: creatorId })
        .returning();

      return {
        id: row.id,
        name: row.name,
        createdBy: creatorUsername,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (err) {
      if (isUniqueViolation(err)) throw new RoomNameTakenException();
      throw err;
    }
  }

  async get(id: string): Promise<RoomDetail> {
    const [row] = await this.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdAt: rooms.createdAt,
        creatorUsername: users.username,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .where(eq(rooms.id, id));

    if (!row) throw new RoomNotFoundException(id);

    return {
      id: row.id,
      name: row.name,
      createdBy: row.creatorUsername,
      activeUsers: await this.presence.count(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async requireOwnedBy(id: string, userId: string) {
    const [row] = await this.db.select().from(rooms).where(eq(rooms.id, id));
    if (!row) throw new RoomNotFoundException(id);
    if (row.createdById !== userId) {
      throw new ForbiddenException('Only the room creator can delete this room');
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(rooms).where(eq(rooms.id, id));
    await this.presence.clear(id);
  }

  async exists(id: string): Promise<boolean> {
    const [row] = await this.db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, id));
    return !!row;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
