import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { type Db, DRIZZLE } from '../src/database/database.providers';
import { messages, rooms, users } from '../src/database/schema';
import { REDIS_CMD } from '../src/redis/redis.tokens';
import { buildApp } from './helpers/bootstrap';
import { login } from './helpers/login';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('rooms', () => {
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

  it('rejects unauthenticated requests with UNAUTHORIZED', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/rooms').expect(401);
    expect(r.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
  });

  it('creates and lists a room', async () => {
    const { sessionToken } = await login(app, 'creator');

    const created = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'general' })
      .expect(201);

    expect(created.body).toEqual({
      success: true,
      data: {
        id: expect.stringMatching(/^room_/),
        name: 'general',
        createdBy: 'creator',
        createdAt: expect.any(String),
      },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/rooms')
      .set(auth(sessionToken))
      .expect(200);

    expect(list.body.data.rooms).toHaveLength(1);
    expect(list.body.data.rooms[0]).toMatchObject({
      name: 'general',
      createdBy: 'creator',
      activeUsers: 0,
    });
  });

  it('rejects duplicate room names with 409 ROOM_NAME_TAKEN', async () => {
    const { sessionToken } = await login(app, 'a');
    await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'dup' })
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'dup' })
      .expect(409);
    expect(dup.body.error.code).toBe('ROOM_NAME_TAKEN');
  });

  it('rejects invalid room names with VALIDATION_ERROR', async () => {
    const { sessionToken } = await login(app, 'a');
    const r = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'bad name with spaces' })
      .expect(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for unknown room', async () => {
    const { sessionToken } = await login(app, 'a');
    const r = await request(app.getHttpServer())
      .get('/api/v1/rooms/room_nope12345')
      .set(auth(sessionToken))
      .expect(404);
    expect(r.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('only the creator may delete', async () => {
    const owner = await login(app, 'owner');
    const intruder = await login(app, 'intruder');

    const room = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(owner.sessionToken))
      .send({ name: 'lounge' });
    const id = room.body.data.id;

    const denied = await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${id}`)
      .set(auth(intruder.sessionToken))
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const ok = await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${id}`)
      .set(auth(owner.sessionToken))
      .expect(200);
    expect(ok.body.data).toEqual({ deleted: true });

    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${id}`)
      .set(auth(owner.sessionToken))
      .expect(404);
  });

  it('reflects activeUsers from Redis', async () => {
    const { sessionToken } = await login(app, 'a');
    const created = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set(auth(sessionToken))
      .send({ name: 'busy' });
    const id = created.body.data.id;

    await redis.hincrby(`room:${id}:presence`, 'a', 1);
    await redis.hincrby(`room:${id}:presence`, 'b', 1);

    const r = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${id}`)
      .set(auth(sessionToken))
      .expect(200);
    expect(r.body.data.activeUsers).toBe(2);
  });
});
