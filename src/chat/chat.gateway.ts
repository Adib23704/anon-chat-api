import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';
import { type Db, DRIZZLE } from '../database/database.providers';
import { rooms, users } from '../database/schema';
import { PresenceService } from '../presence/presence.service';
import { REDIS_CMD } from '../redis/redis.tokens';
import { ClientEvents, ServerEvents } from './chat-events';
import { type SocketMeta, SocketMetaStore } from './socket-meta';

@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly presence: PresenceService,
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REDIS_CMD) private readonly redis: Redis,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const { token, roomId } = readQuery(socket);
      if (!token || !roomId) return reject(socket, 401, 'Unauthorized');

      const userId = await this.sessions.resolve(token);
      if (!userId) return reject(socket, 401, 'Unauthorized');

      const [user] = await this.db.select().from(users).where(eq(users.id, userId));
      if (!user) return reject(socket, 401, 'Unauthorized');

      const [room] = await this.db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId));
      if (!room) return reject(socket, 404, 'Room not found');

      const meta: SocketMeta = { userId: user.id, username: user.username, roomId };
      socket.data = meta;
      await SocketMetaStore.set(this.redis, socket.id, meta);

      await socket.join(roomId);
      const { activeUsers } = await this.presence.join(roomId, user.username);

      socket.emit(ServerEvents.RoomJoined, { activeUsers });
      socket.to(roomId).emit(ServerEvents.RoomUserJoined, { username: user.username, activeUsers });
    } catch (err) {
      this.logger.error('handleConnection failed', err as Error);
      reject(socket, 500, 'Internal error');
    }
  }

  async handleDisconnect(socket: Socket) {
    await this.cleanup(socket);
  }

  @SubscribeMessage(ClientEvents.RoomLeave)
  async onLeave(@ConnectedSocket() socket: Socket) {
    await this.cleanup(socket);
    socket.disconnect(true);
  }

  private async cleanup(socket: Socket) {
    const meta =
      (socket.data as SocketMeta | undefined) ?? (await SocketMetaStore.get(this.redis, socket.id));
    if (!meta?.roomId || !meta.username) return;

    await SocketMetaStore.clear(this.redis, socket.id);

    const { isLastConnection, activeUsers } = await this.presence.leave(meta.roomId, meta.username);

    if (isLastConnection) {
      socket.to(meta.roomId).emit(ServerEvents.RoomUserLeft, {
        username: meta.username,
        activeUsers,
      });
    }
  }
}

function readQuery(socket: Socket) {
  const q = socket.handshake.query as Record<string, string | string[] | undefined>;
  const pick = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
  return { token: pick(q.token), roomId: pick(q.roomId) };
}

function reject(socket: Socket, code: number, message: string) {
  socket.emit('error', { code, message });
  socket.disconnect(true);
}
