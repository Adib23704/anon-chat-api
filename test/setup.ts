import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://chat:chat@localhost:5432/chat_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
