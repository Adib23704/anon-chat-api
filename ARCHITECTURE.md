# Architecture

Design notes for `anon-chat-api`. This document covers the choices behind it: how data flows, how Redis is used, what scales and what doesn't.

## Overview

```
                       client (REST + WebSocket)
                                  |
                                  v
                  +---------------+---------------+
                  |     Nest app instance(s)      |
                  |  REST controllers + /chat WS  |
                  +-------+---------------+-------+
                          |               |
                     Drizzle           ioredis
                          |               |
                          v               v
                      Postgres           Redis
                                          |
                                          +--  session:{token}    -> userId   (24h TTL)
                                          +--  room:{id}:presence (HASH user -> conn count)
                                          +--  sock:{socketId}    (HASH userId, username, roomId)
                                          +--  chat:events        (REST -> gateway pub/sub)
                                          +--  @socket.io/redis-adapter  (gateway broadcast bus)
```

REST controllers validate input, do their DB work via Drizzle, and either return a payload or throw a domain exception. A global interceptor wraps successful responses in `{success: true, data: ...}`. A global exception filter turns thrown errors into `{success: false, error: {code, message}}` with the right HTTP status. `/health` writes its response directly with `@Res()` so the ops payload stays flat.

WebSocket lives at the `/chat` namespace. Auth and room existence are checked at handshake. On success the socket joins the Socket.io room, presence is recorded, and `room:joined` goes to the connector while `room:user_joined` goes to everyone else.

Connection state never lives in process memory. The spec rules out in-memory `Map<socketId, ...>` and the implementation honours that: per-socket metadata is a Redis hash (`sock:{id}`), per-room presence is another (`room:{id}:presence`). `socket.data` is used as a per-connection cache so we don't round-trip Redis on every event from a live socket, but the Redis hash is the source of truth.

Database access is exclusively through Drizzle. There is no raw SQL outside the migration files Drizzle itself generates.

### Module layout

Feature modules with explicit dependencies, no circular imports:

- `auth` - sessions, login endpoint, exports `SessionService` for the guard
- `presence` - Redis HASH operations for active users
- `rooms` - rooms CRUD; depends on `presence` (active count) and `chat` (delete broadcast)
- `messages` - send and paginated list; depends on `rooms` (existence check) and `chat` (message broadcast)
- `chat` - WS gateway, pub/sub publisher, subscriber bridge

Cross-cutting plumbing (envelope interceptor, exception filter, validation pipe, auth guard, ID generator) lives under `common/`.

## Sessions

Tokens are opaque random bytes, not JWTs. On each `POST /login`:

1. Upsert the user by username. The same name always resolves to the same `usr_xxx` id.
2. Generate `crypto.randomBytes(32).toString('base64url')`, a 43-character URL-safe string.
3. `SET session:{token} <userId> EX 86400`.

On every authenticated request the auth guard reads the bearer header, looks up `session:{token}` in Redis, hydrates the user from Postgres, and attaches them to the request. A miss or expiry returns `UNAUTHORIZED`. There's no refresh endpoint; the spec treats login as get-or-create, so the client just logs in again when the token expires.

Each login mints a fresh token without revoking earlier ones. The 24-hour TTL handles cleanup. Single-active-session would be a one-line `del` of any prior token before the new `set`.

JWTs were considered and rejected. The spec explicitly says "opaque token", and Redis lookups give us instant revocation, both of which JWTs would complicate without buying anything for this contract.

## Redis pub/sub fan-out

Two scenarios, two mechanisms.

### Gateway-originated events

`room:joined`, `room:user_joined`, `room:user_left` all originate inside the gateway in response to a socket connecting, disconnecting, or sending `room:leave`. The Socket.io Redis adapter handles cross-instance fan-out for these events for free: when the gateway calls `server.to(roomId).emit(...)`, the adapter republishes through Redis and every instance delivers to its own sockets in that room.

### REST-originated events

`message:new` (after `POST /rooms/:id/messages`) and `room:deleted` (right before `DELETE /rooms/:id` actually drops the row) cannot be emitted from the controller. The spec is specific:

> After saving to the database, publish a `message:new` event to Redis. The WebSocket gateway subscribes to this channel and broadcasts to all connected clients in the room - including those on other server instances. Do not emit directly from the REST controller.

So there's a dedicated channel separate from the Socket.io adapter:

1. The REST service persists to Postgres.
2. `ChatPubSub.publish(envelope)` publishes to Redis channel `chat:events` via the command client.
3. Each Nest instance has a `PubSubBridge` that subscribed to `chat:events` at boot using the dedicated subscriber connection.
4. On a message, the bridge emits to that instance's local sockets only:

   ```ts
   server.local.to(roomId).emit(eventName, payload);
   ```

The `.local` qualifier is the load-bearing piece. Without it, the adapter would also re-broadcast through Redis and every client in the room would receive the same event twice (once from the local emit, once from the adapter republishing it). With `.local`, the publish is the cross-instance step and each instance just delivers to the sockets it owns. Every connected client receives the event exactly once.

For `room:deleted` the bridge additionally calls `server.local.in(roomId).fetchSockets()` and disconnects each, so clients close cleanly per the spec.

Why not use one mechanism for both? The adapter is the natural fit when the gateway is the source. The dedicated channel is what the spec asks for on the REST side and `.local` keeps delivery exactly-once. Using the adapter for REST-originated events would either violate the spec's "do not emit directly from the REST controller" or require dedup logic that's brittle under reconnects.

## Capacity (single instance)

Educated guess, not a benchmark. On a small VPS (1 vCPU, 1 GB RAM, e.g. a Hetzner CX22 or equivalent):

- 3,000 to 5,000 concurrent WebSocket connections. Per-socket memory in a Node + Socket.io setup runs roughly 10–30 KB; memory isn't the wall, event-loop latency under fan-out is.
- 300 to 500 messages per second sustained. Each message is one Postgres `INSERT`, one Redis `PUBLISH`, and a fan-out emit whose cost grows with room size.

The Postgres pool is fixed at 10 connections in `database.providers.ts`, which is the hard ceiling on in-flight DB calls per instance. Redis isn't the bottleneck at this scale: `HINCRBY`, `HKEYS`, `PUBLISH` all run in microseconds.

The first ceiling I'd actually expect to hit is event-loop saturation when a large room produces a burst of messages. Socket.io fan-out is linear in room size and Node is single-threaded, so past a certain message rate the loop falls behind and latency climbs.

These numbers are based on similar setups, not a benchmark of this codebase. A real load test would refine them.

## Scaling 10×

Roughly ordered by "biggest win first, smallest disruption first":

1. More instances behind a load balancer. The design already supports horizontal scaling. Connection state is in Redis, sessions are central, the pub/sub bus is shared. Sticky sessions are not required because no per-socket state lives in any one instance's memory. Cheapest, biggest win.
2. Per-room pub/sub channels. Right now every instance receives every `chat:events` message and discards the ones for rooms it has no sockets in. At high message rate that wastes work. Switching to `chat:room:{id}` would let each instance subscribe only to the rooms it has sockets in. Subscription churn becomes something to manage; per-message cost drops substantially.
3. Postgres read replicas. `GET /rooms/:id/messages` is the hot read path. Routing it to a replica is a small change in the database providers and offloads pressure from the primary.
4. Write-behind buffer for messages. Batch inserts on a 50ms interval and use multi-row `INSERT VALUES (...)`. Adds a tiny amount of latency, multiplies throughput. Only worth doing past a measured ceiling on the simple INSERT.
5. Split presence onto its own Redis instance. Presence reads happen on every connect/disconnect and every `GET /rooms`. If main Redis CPU starts saturating, this is the cheapest piece to peel off.

## Trade-offs and known limits

- Username squatting. No password layer means anyone can claim any free name. The spec doesn't ask for more, but a real product would need a sign-up flow or a name-reservation grace period.
- Token rotation. Each login mints a new token without revoking earlier ones; they all live their 24h TTL independently. Multiple active sessions per user are possible.
- Pub/sub is at-most-once. If the Redis connection drops between `PUBLISH` returning and a subscriber receiving the message, that broadcast is lost for currently-connected viewers. The DB row survives, so a refresh recovers history. Acceptable for chat, not for anything financial.
- Cursor pagination depends on the cursor row existing. There's no `DELETE /messages/:id` in the contract, so the only way the cursor disappears is `DELETE /rooms/:id` cascading. In that case the next paginated request gets the latest page rather than picking up where it left off.
- Single region. No replication, no failover. A regional outage takes the service down. Multi-region would mean per-region clusters and either accepting cross-region delivery delay or building a federation layer.
- No multi-instance pub/sub fan-out test. The e2e suite proves the contract on a single instance. Verifying that two instances correctly fan out via Redis would need a multi-process harness, which I left out for time. The unit-of-fan-out (`server.local.to(...).emit(...)`) is exercised by every relevant e2e test on a single instance.
- `/health` is liveness, not readiness. It pings Postgres and Redis but doesn't verify the pub/sub subscriber is actually subscribed. The bridge logs an error if `subscribe()` fails so it's visible, but a dedicated readiness probe is better before doing rolling deploys.
- Throttling is per-IP. If the app ever sits behind a reverse proxy or load balancer, it'll need `app.set('trust proxy', ...)` and `X-Forwarded-For` so the throttler sees the real client and not the upstream's address.
