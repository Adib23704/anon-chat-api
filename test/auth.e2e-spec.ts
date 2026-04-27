import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { type Db, DRIZZLE } from '../src/database/database.providers';
import { messages, rooms, users } from '../src/database/schema';
import { REDIS_CMD } from '../src/redis/redis.tokens';
import { buildApp } from './helpers/bootstrap';

describe('POST /api/v1/login', () => {
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

  it('creates a user and returns a session token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username: 'ali_123' })
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      data: {
        sessionToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        user: {
          id: expect.stringMatching(/^usr_/),
          username: 'ali_123',
          createdAt: expect.any(String),
        },
      },
    });
  });

  it('returns the same user on repeat login with a fresh token', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username: 'sara_x' });
    const second = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username: 'sara_x' });

    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.sessionToken).not.toBe(first.body.data.sessionToken);
  });

  it('rejects too-short usernames with VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username: 'a' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects usernames with disallowed characters', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username: 'has space' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
