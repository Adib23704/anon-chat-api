import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { type Db, DRIZZLE } from '../src/database/database.providers';
import { messages, rooms, users } from '../src/database/schema';
import { REDIS_CMD } from '../src/redis/redis.tokens';
import { buildApp } from './helpers/bootstrap';
import { login } from './helpers/login';
import { connect, once } from './helpers/ws-client';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('chat gateway', () => {
  let app: INestApplication;
  let db: Db;
  let redis: Redis;
  let url: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.listen(0);
    db = app.get<Db>(DRIZZLE);
    redis = app.get<Redis>(REDIS_CMD);

    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
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

  async function setupRoomFor(username: string) {
    const { sessionToken } = await login(app, username);
    const r = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: `r${Math.random().toString(36).slice(2, 8)}` });
    return { sessionToken, roomId: r.body.data.id as string };
  }

  it('rejects bad token with code 401', async () => {
    const { roomId } = await setupRoomFor('alice');
    const sock = connect({ url, token: 'nope', roomId });
    const err = await once<{ code: number }>(sock, 'error');
    expect(err.code).toBe(401);
    sock.close();
  });

  it('rejects unknown roomId with code 404', async () => {
    const { sessionToken } = await login(app, 'alice');
    const sock = connect({ url, token: sessionToken, roomId: 'room_nope12345' });
    const err = await once<{ code: number }>(sock, 'error');
    expect(err.code).toBe(404);
    sock.close();
  });

  it('emits room:joined to the connector and room:user_joined to others; room:user_left on disconnect', async () => {
    const a = await setupRoomFor('alice');
    const bob = await login(app, 'bob');

    const sockA = connect({ url, token: a.sessionToken, roomId: a.roomId });
    const joinedA = await once<{ activeUsers: string[] }>(sockA, 'room:joined');
    expect(joinedA.activeUsers).toEqual(['alice']);

    const otherJoined = once<{ username: string; activeUsers: string[] }>(
      sockA,
      'room:user_joined',
    );

    const sockB = connect({ url, token: bob.sessionToken, roomId: a.roomId });
    const joinedB = await once<{ activeUsers: string[] }>(sockB, 'room:joined');
    expect(new Set(joinedB.activeUsers)).toEqual(new Set(['alice', 'bob']));

    const arrival = await otherJoined;
    expect(arrival.username).toBe('bob');
    expect(new Set(arrival.activeUsers)).toEqual(new Set(['alice', 'bob']));

    const left = once<{ username: string; activeUsers: string[] }>(sockA, 'room:user_left');
    sockB.disconnect();
    const leftPayload = await left;
    expect(leftPayload).toEqual({ username: 'bob', activeUsers: ['alice'] });

    sockA.close();
  });

  it('handles room:leave from the client', async () => {
    const a = await setupRoomFor('alice');
    const bob = await login(app, 'bob');

    const sockA = connect({ url, token: a.sessionToken, roomId: a.roomId });
    await once(sockA, 'room:joined');

    const sockB = connect({ url, token: bob.sessionToken, roomId: a.roomId });
    await once(sockB, 'room:joined');

    const left = once<{ username: string; activeUsers: string[] }>(sockA, 'room:user_left');
    sockB.emit('room:leave');
    const payload = await left;
    expect(payload).toEqual({ username: 'bob', activeUsers: ['alice'] });

    sockA.close();
  });

  it('broadcasts message:new when a REST POST hits /messages', async () => {
    const owner = await setupRoomFor('alice');

    const sock = connect({ url, token: owner.sessionToken, roomId: owner.roomId });
    await once(sock, 'room:joined');

    const incoming = once<{
      id: string;
      username: string;
      content: string;
      createdAt: string;
    }>(sock, 'message:new');

    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${owner.roomId}/messages`)
      .set(auth(owner.sessionToken))
      .send({ content: 'broadcast me' })
      .expect(201);

    const evt = await incoming;
    expect(evt).toEqual({
      id: expect.stringMatching(/^msg_/),
      username: 'alice',
      content: 'broadcast me',
      createdAt: expect.any(String),
    });

    sock.close();
  });

  it('broadcasts room:deleted and disconnects clients on DELETE /rooms/:id', async () => {
    const owner = await setupRoomFor('owner');
    const guest = await login(app, 'guest');

    const sock = connect({ url, token: guest.sessionToken, roomId: owner.roomId });
    await once(sock, 'room:joined');

    const deleted = once<{ roomId: string }>(sock, 'room:deleted');
    const disconnected = new Promise<void>((resolve) => sock.once('disconnect', () => resolve()));

    await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${owner.roomId}`)
      .set(auth(owner.sessionToken))
      .expect(200);

    expect(await deleted).toEqual({ roomId: owner.roomId });
    await disconnected;
  });
});
