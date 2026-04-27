import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { ChatPubSub } from '../chat/pubsub.service';
import {
  MessageEmptyException,
  MessageTooLongException,
  RoomNotFoundException,
} from '../common/exceptions';
import { newMessageId } from '../common/id-generator';
import { type Db, DRIZZLE } from '../database/database.providers';
import { messages, users } from '../database/schema';
import { RoomsService } from '../rooms/rooms.service';
import { buildPage } from './pagination';

const MAX_LEN = 1000;

export type MessageView = {
  id: string;
  roomId: string;
  username: string;
  content: string;
  createdAt: string;
};

export type MessagesPage = {
  messages: MessageView[];
  hasMore: boolean;
  nextCursor: string | null;
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly rooms: RoomsService,
    private readonly pubsub: ChatPubSub,
  ) {}

  async send(roomId: string, userId: string, username: string, raw: string): Promise<MessageView> {
    if (!(await this.rooms.exists(roomId))) {
      throw new RoomNotFoundException(roomId);
    }

    const content = raw?.trim() ?? '';
    if (content.length === 0) throw new MessageEmptyException();
    if (content.length > MAX_LEN) throw new MessageTooLongException();

    const [row] = await this.db
      .insert(messages)
      .values({ id: newMessageId(), roomId, userId, content })
      .returning();

    const createdAt = row.createdAt.toISOString();

    await this.pubsub.publish({
      type: 'message:new',
      roomId,
      payload: { id: row.id, username, content: row.content, createdAt },
    });

    return {
      id: row.id,
      roomId: row.roomId,
      username,
      content: row.content,
      createdAt,
    };
  }

  async list(roomId: string, limit: number, before: string | undefined): Promise<MessagesPage> {
    if (!(await this.rooms.exists(roomId))) {
      throw new RoomNotFoundException(roomId);
    }

    const cursor = before ? await this.lookupCursor(roomId, before) : null;

    const where = cursor
      ? and(
          eq(messages.roomId, roomId),
          or(
            lt(messages.createdAt, cursor.createdAt),
            and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
          ),
        )
      : eq(messages.roomId, roomId);

    const rows = await this.db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        content: messages.content,
        createdAt: messages.createdAt,
        username: users.username,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(where)
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);

    const page = buildPage(rows, limit);

    return {
      messages: page.items.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        username: r.username,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  }

  private async lookupCursor(roomId: string, id: string) {
    const [row] = await this.db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.roomId, roomId)));
    return row ?? null;
  }
}
