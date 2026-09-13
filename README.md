# Anon Chat API

Real-time anonymous chat service built with NestJS, PostgreSQL, Redis, and Socket.io. Features ephemeral username-based sessions, persistent chat rooms with cursor pagination, live presence tracking, and multi-instance WebSocket broadcasting over Redis pub/sub.

Live deployment: [https://chat.adibdev.me](https://chat.adibdev.me) | Docs: [https://chat.adibdev.me/docs](https://chat.adibdev.me/docs)

## Tech Stack

- **Framework**: NestJS 12 (Express platform)
- **Language**: TypeScript 7
- **Database**: PostgreSQL with Drizzle ORM
- **Cache & Pub/Sub**: Redis (ioredis)
- **WebSockets**: Socket.io 4 with `@socket.io/redis-adapter`
- **Tooling**: Biome (formatter & linter), Jest (unit testing), pnpm

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL 16+
- Redis 7+

### Quickstart

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Update `DATABASE_URL` and `REDIS_URL` to match your local or hosted instances.

3. Apply database migrations:
   ```bash
   pnpm db:migrate
   ```

4. Start development server:
   ```bash
   pnpm dev
   ```

The API starts on port `3000` by default. You can verify system health at `http://localhost:3000/health` and explore the interactive Swagger OpenAPI documentation at `http://localhost:3000/docs`.

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | `3000` | HTTP port the server listens on |
| `DATABASE_URL` | `postgres://chat:chat@localhost:5432/chat` | PostgreSQL connection URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `LOG_LEVEL` | `info` | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `SESSION_TTL_SECONDS` | `86400` | Session lifetime in seconds (default: 24 hours) |

> **Note**: If your database password contains special characters (`&`, `%`, `@`), remember to percent-encode them in `DATABASE_URL`.

## Available Scripts

| Script | Description |
| :--- | :--- |
| `pnpm dev` | Starts the app with TypeScript watch mode |
| `pnpm build` | Compiles TypeScript source to `./dist` |
| `pnpm start` | Runs compiled production build (`node dist/main.js`) |
| `pnpm db:generate` | Generates SQL migrations from schema |
| `pnpm db:migrate` | Runs pending Drizzle migrations |
| `pnpm test` | Runs unit test suite |
| `pnpm test:watch` | Runs unit tests in watch mode |
| `pnpm lint` / `pnpm lint:fix` | Runs Biome linter (with optional auto-fix) |
| `pnpm format` | Formats source files with Biome |
| `pnpm typecheck` | Validates TypeScript types without emitting JS |
| `pnpm validate` | Full pipeline check: Biome lint/format + TypeScript typecheck |

## API & WebSocket Overview

### Authentication
- `POST /api/v1/login` - Accepts `{ "username": "string" }`. Returns a 43-character opaque session token and user profile. Existing usernames return the same user ID with a freshly minted session token.
- Protected routes require the `Authorization: Bearer <sessionToken>` header.

### REST Endpoints
- `GET /api/v1/rooms` - Lists all rooms with active participant counts.
- `POST /api/v1/rooms` - Creates a new room.
- `GET /api/v1/rooms/:id` - Fetches room details.
- `DELETE /api/v1/rooms/:id` - Deletes a room, cascades message cleanup, and disconnects room sockets.
- `GET /api/v1/rooms/:id/messages?before=<msg_id>&limit=<n>` - Cursor-paginated message history.
- `POST /api/v1/rooms/:id/messages` - Sends a message, persists to database, and triggers real-time broadcast.
- `GET /health` - Health check reporting database and Redis status.

### WebSocket Gateway
- Namespace: `/chat`
- Handshake query params: `?token=<sessionToken>&roomId=<roomId>`
- Socket events:
  - `room:joined` - Sent to connecting socket on successful join.
  - `room:user_joined` / `room:user_left` - Broadcasts room presence changes.
  - `message:new` - Real-time message broadcast to room members.
  - `room:deleted` - Sent prior to socket disconnection when a room is removed.

## Docker

Run the complete stack (Postgres, Redis, and API) via Docker Compose:

```bash
docker compose up -d --build
```

View application logs:

```bash
docker compose logs -f app
```

Stop services:

```bash
docker compose down
```
