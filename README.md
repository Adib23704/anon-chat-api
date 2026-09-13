# Anonymous-Chat-API

Real-time anonymous chat backend. Username-only login, opaque 24h session tokens, rooms with persistent message history, live presence over Socket.io, scaled across instances by Redis pub/sub.

Live deploy: https://chat.adibdev.me.

## Stack

- NestJS 11 (TypeScript)
- PostgreSQL with Drizzle ORM
- Redis via ioredis
- Socket.io 4 with `@socket.io/redis-adapter`
- Biome for formatting and linting
- Jest for unit tests
- pnpm

## Setup

You'll need Postgres 16+ and Redis 7+ reachable from somewhere. Docker compose is the easiest path; instructions below.

```bash
pnpm install
cp .env.example .env       # adjust DATABASE_URL / REDIS_URL if needed
pnpm db:migrate
pnpm dev
```

The app listens on port 3000. `curl localhost:3000/health` returns `{"status":"ok","db":"ok","redis":"ok"}` once the DB and Redis are up.

`.env` is loaded automatically (via `dotenv/config` at the top of `main.ts` and the migration script). For tests put values in `.env.test`; the test setup reads it before falling back to `.env` and inline defaults.

## Environment

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://chat:chat@localhost:5432/chat
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
SESSION_TTL_SECONDS=86400
```

`SESSION_TTL_SECONDS` is the session lifetime; the default 24h matches the spec. If your Postgres password contains characters like `&` or `%`, percent-encode them in the URL (`%26`, `%25`).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run the compiled app |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm test` | Unit tests |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm format` | Biome format |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm validate` | `biome check` + typecheck (use this in CI) |

## Tests

Unit tests don't need anything external:

```bash
pnpm test
```

## Project layout

```
src/
  main.ts                 helmet, validation pipe, envelope, exception filter, ws adapter
  app.module.ts
  config/                 zod-validated env, pino logger config
  common/                 envelope interceptor, exception filter, domain exceptions, auth guard, @Public, @CurrentUser, id generator
  database/               drizzle client + schema + migration runner
  redis/                  ioredis providers (cmd + sub)
  auth/                   POST /login, sessions in Redis, AuthGuard
  presence/               room:{id}:presence HASH (multi-tab safe)
  rooms/                  rooms CRUD
  messages/               messages send + paginated list
  chat/                   /chat WS gateway, pub/sub publisher + subscriber bridge
  health/                 GET /health (DB + Redis ping)
drizzle/                  generated SQL migrations
```

`ARCHITECTURE.md` is the design walkthrough: diagram, session strategy, pub/sub flow, capacity numbers, scaling plan, and an honest list of the things that would need work before this is production-grade.

## Docker

`docker-compose.yml` brings up Postgres, Redis, and the app together. Migrations run before the server starts.

```bash
docker compose up -d --build
docker compose logs -f app
curl localhost:3000/health
```

All exposed ports are bound to `127.0.0.1` so nothing leaks onto the public interface even without a host firewall. Stop with `docker compose down`. Named volumes (`pgdata`, `redisdata`) survive restarts.

## Updates

```bash
git pull && docker compose up -d --build
```

Migrations apply automatically on container start.

## Smoke Test

```bash
curl https://chat.adibdev.me/health
curl -X POST https://chat.adibdev.me/api/v1/login \
  -H 'content-type: application/json' \
  -d '{"username":"smoke"}'
```
