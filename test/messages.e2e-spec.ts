import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { type Db, DRIZZLE } from '../src/database/database.providers';
import { messages, rooms, users } from '../src/database/schema';
import { REDIS_CMD } from '../src/redis/redis.tokens';
import { buildApp } from './helpers/bootstrap';
import { login } from './helpers/login';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('messages', () => {
  let app: INestApplication;
  let db: Db;
  let redis: Redis;

  beforeAll(async () => {
    app = await buildApp();
    db = app.get<Db>(DRIZZLE);
    redis = app.get<Redis>(REDIS_CMD);
  });

  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(rooms);
    await db.delete(users);
    await redis.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupRoom() {
    const { sessionToken, user } = await login(app, 'sender');
    const r = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'r1' });
    return { sessionToken, user, roomId: r.body.data.id as string };
  }

  it('persists a message and returns it on list (content trimmed)', async () => {
    const { sessionToken, roomId } = await setupRoom();

    const sent = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set(auth(sessionToken))
      .send({ content: '  hello  ' })
      .expect(201);

    expect(sent.body).toEqual({
      success: true,
      data: {
        id: expect.stringMatching(/^msg_/),
        roomId,
        username: 'sender',
        content: 'hello',
        createdAt: expect.any(String),
      },
    });

    const list = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/messages`)
      .set(auth(sessionToken))
      .expect(200);

    expect(list.body.data.messages).toHaveLength(1);
    expect(list.body.data.messages[0].content).toBe('hello');
    expect(list.body.data.hasMore).toBe(false);
    expect(list.body.data.nextCursor).toBeNull();
  });

  it('rejects empty (after trim) content with MESSAGE_EMPTY', async () => {
    const { sessionToken, roomId } = await setupRoom();
    const r = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set(auth(sessionToken))
      .send({ content: '   ' })
      .expect(422);
    expect(r.body.error.code).toBe('MESSAGE_EMPTY');
  });

  it('rejects overlong content with MESSAGE_TOO_LONG', async () => {
    const { sessionToken, roomId } = await setupRoom();
    const r = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set(auth(sessionToken))
      .send({ content: 'x'.repeat(1001) })
      .expect(422);
    expect(r.body.error.code).toBe('MESSAGE_TOO_LONG');
  });

  it('paginates with the before cursor', async () => {
    const { sessionToken, roomId } = await setupRoom();

    for (let i = 0; i < 7; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/messages`)
        .set(auth(sessionToken))
        .send({ content: `m${i}` })
        .expect(201);
    }

    const first = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/messages?limit=3`)
      .set(auth(sessionToken))
      .expect(200);

    expect(first.body.data.messages).toHaveLength(3);
    expect(first.body.data.hasMore).toBe(true);

    const second = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/messages?limit=3&before=${first.body.data.nextCursor}`)
      .set(auth(sessionToken))
      .expect(200);

    expect(second.body.data.messages).toHaveLength(3);

    const firstContents = first.body.data.messages.map((m: { content: string }) => m.content);
    const secondContents = second.body.data.messages.map((m: { content: string }) => m.content);
    expect(firstContents).not.toEqual(secondContents);
    for (const c of secondContents) expect(firstContents).not.toContain(c);
  });

  it('404 ROOM_NOT_FOUND when posting to unknown room', async () => {
    const { sessionToken } = await login(app, 'a');
    const r = await request(app.getHttpServer())
      .post('/api/v1/rooms/room_nope12345/messages')
      .set(auth(sessionToken))
      .send({ content: 'hi' })
      .expect(404);
    expect(r.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('404 ROOM_NOT_FOUND when listing messages of unknown room', async () => {
    const { sessionToken } = await login(app, 'a');
    const r = await request(app.getHttpServer())
      .get('/api/v1/rooms/room_nope12345/messages')
      .set(auth(sessionToken))
      .expect(404);
    expect(r.body.error.code).toBe('ROOM_NOT_FOUND');
  });
});
