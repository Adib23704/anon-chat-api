# Architecture

Technical design and architectural overview for `anon-chat-api`.

## System Overview

```
                        Client (HTTP / WebSocket)
                                   |
                                   v
                   +---------------+---------------+
                   |       NestJS API Node(s)      |
                   |  REST Controllers + /chat GW  |
                   +-------+---------------+-------+
                           |               |
                      Drizzle ORM       ioredis
                           |               |
                           v               v
                      PostgreSQL         Redis
                                           |
                                           +--  session:{token}    -> userId (Key-Value, 24h TTL)
                                           +--  room:{id}:presence -> {username: count} (Hash)
                                           +--  sock:{socketId}    -> {userId, username, roomId} (Hash)
                                           +--  chat:events        (Pub/Sub for REST mutations)
                                           +--  @socket.io/redis-adapter (WS cluster broadcast bus)
```

The system separates persistent storage from transient session and connection state:
- **PostgreSQL** stores durable relational entities (`users`, `rooms`, `messages`).
- **Redis** manages ephemeral state: user sessions, socket routing metadata, real-time presence counters, and multi-node event distribution.
- **NestJS Application Layer** handles REST endpoints and WebSocket connections statelessly, allowing instances to scale horizontally behind a reverse proxy or load balancer.

## State Management & Storage

### 1. Relational Data (PostgreSQL)
All database interactions use Drizzle ORM with strict typing. Schema migrations are managed via Drizzle Kit.

- `users`: Unique identifier (`usr_<nanoid>`), unique username, creation timestamp.
- `rooms`: Unique identifier (`room_<nanoid>`), unique room name, creator reference, creation timestamp.
- `messages`: Message ID (`msg_<nanoid>`), room foreign key (cascade delete), author foreign key (restrict delete), text content, creation timestamp. Indexed by `(room_id, created_at DESC, id DESC)` for efficient cursor pagination.

### 2. Ephemeral State (Redis)
All instance state is externalized to Redis so that any request or socket event can be serviced by any running node without shared process memory:

- **Sessions (`session:<token>`)**: String key storing the associated `userId`, with an expiring TTL (default 24 hours). Tokens are cryptographically generated 32-byte URL-safe base64 strings.
- **Socket Metadata (`sock:<socketId>`)**: Hash storing `{ userId, username, roomId }` for fast lookups on disconnect or cleanup without needing in-memory socket maps.
- **Room Presence (`room:<roomId>:presence`)**: Hash mapping `username -> connectionCount`. Incrementing/decrementing counts via `HINCRBY` allows users with multiple open tabs to maintain presence without premature `leave` notifications.

## Real-Time Event Architecture & Fan-out

The system handles real-time events through two distinct paths depending on the event source:

### 1. Gateway-Originated Events (Connection & Presence)
Events triggered directly by socket lifecycle changes (`room:joined`, `room:user_joined`, `room:user_left`):
- Handled directly within `ChatGateway`.
- When a client connects or leaves, the gateway updates presence in Redis and broadcasts to the Socket.io room (`server.to(roomId).emit(...)`).
- Multi-node fan-out is handled automatically by `@socket.io/redis-adapter`, which mirrors room broadcasts across all cluster instances.

### 2. REST-Originated Events (Messages & Room Deletion)
Mutations triggered via HTTP endpoints (`POST /rooms/:id/messages` and `DELETE /rooms/:id`):
- Messages are first persisted to PostgreSQL inside `MessagesService`.
- Upon successful commit, `ChatPubSub` publishes an event envelope to the Redis channel `chat:events`.
- Every active API node runs a singleton `PubSubBridge` subscribed to `chat:events`.
- When an event arrives, each instance broadcasts **locally** to its connected sockets using `server.local.to(roomId).emit(...)`.
- Using `.local` prevents duplicate delivery: the message was already propagated across instances via `chat:events`, so the socket adapter does not re-broadcast it across instances a second time.

## Concurrency & Request Lifecycle

- **Request Validation**: Incoming payloads are validated at the perimeter via `ValidationPipe` using `class-validator` rules, rejecting malformed requests before controller execution.
- **Response Normalization**: `EnvelopeInterceptor` standardizes successful REST responses into `{ success: true, data: ... }`.
- **Exception Normalization**: `HttpExceptionFilter` catches domain exceptions and standard HTTP errors, translating them into `{ success: false, error: { code, message } }`.
- **Graceful Teardown**: Database pools and Redis connections (command, subscriber, and adapter clients) implement lifecycle hooks (`OnApplicationShutdown` / `dispose`) to close connections cleanly on SIGTERM/SIGINT.

## Scaling Considerations

1. **Stateless Nodes**: Because connection metadata and presence live in Redis, API instances do not require sticky sessions for REST calls or socket traffic.
2. **Database Read Scalability**: High-throughput message history queries (`GET /rooms/:id/messages`) can be offloaded to read replicas with minimal changes to database providers.
3. **Channel Sharding**: In very large deployments with high message throughput across thousands of rooms, the global `chat:events` pub/sub channel can be partitioned by room (`chat:room:<roomId>`) so instances only process traffic for rooms where they maintain local connections.
