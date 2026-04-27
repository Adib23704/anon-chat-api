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
    const { roomId } = await setupRoomFor('a');
    const sock = connect({ url, token: 'nope', roomId });
    const err = await once<{ code: number }>(sock, 'error');
    expect(err.code).toBe(401);
    sock.close();
  });

  it('rejects unknown roomId with code 404', async () => {
    const { sessionToken } = await login(app, 'a');
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
});
