import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export type LoginResult = {
  sessionToken: string;
  user: { id: string; username: string; createdAt: string };
};

export async function login(app: INestApplication, username: string): Promise<LoginResult> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/login')
    .send({ username })
    .expect(200);
  return res.body.data as LoginResult;
}
