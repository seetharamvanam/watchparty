# watchparty

Friends watch a movie or video **together in sync** and see/hear each other over camera and microphone (WebRTC).

This repository is the Watch Party backend: Next.js App Router + TypeScript APIs, Drizzle/Neon schema, Ably realtime tokens, and LiveKit Cloud A/V tokens.

The full HTTP contract is in [`API.md`](./API.md).

## Product rules

- Maximum **8** participants per room
- **No user accounts** — opaque participant session tokens only
- **No call recording**
- The server **never proxies, fetches, or stores media bytes**. No youtube-dl. The host provides a YouTube URL or a direct `mp4` / `webm` / `m3u8`; clients load media themselves
- No production secrets in the client — only `NEXT_PUBLIC_*` values are browser-visible
- Join by a **6-character room code**
- A room expires **24 hours after the last presence** heartbeat

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js App Router + TypeScript |
| Realtime sync / chat events | [Ably](https://ably.com) channel `room:{code}` |
| Camera + microphone | [LiveKit Cloud](https://livekit.io) (server-minted short-lived tokens) |
| Database | Neon Postgres + [Drizzle ORM](https://orm.drizzle.team) |
| Auth | `Authorization: Bearer <sessionToken>` issued on create/join |

## Setup

```bash
npm install
cp .env.example .env
# fill in secrets
npm run db:migrate
npm run dev
```

Run tests:

```bash
npm test
```

## Environment variables

Exact names (also listed in `.env.example`):

### Server only

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `ABLY_API_KEY` | Mint Ably tokens and publish room events |
| `LIVEKIT_API_KEY` | Mint LiveKit A/V tokens |
| `LIVEKIT_API_SECRET` | Sign LiveKit A/V tokens |
| `SESSION_SECRET` | HMAC key for hashing participant session tokens |

### Public (safe in the browser)

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud WebSocket URL returned by `/av-token` |
| `NEXT_PUBLIC_APP_URL` | Public origin of this app |

## Key endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/rooms` | Create room `{ displayName, mediaUrl?, title? }` |
| `POST` | `/api/rooms/join` | Join `{ code, displayName }` |
| `GET` | `/api/rooms/:code` | Room + participants + playback |
| `POST` | `/api/rooms/:code/media` | Host sets `mediaUrl` |
| `POST` | `/api/rooms/:code/playback` | Host `play\|pause\|seek\|rate\|change_media` |
| `GET` | `/api/rooms/:code/playback` | Current playback |
| `POST` | `/api/realtime/token` | Ably token for `room:{code}` |
| `POST` | `/api/rooms/:code/av-token` | LiveKit token `{ token, url, roomName, identity, expiresAt }` |
| `POST` / `GET` | `/api/rooms/:code/chat` | Persisted chat, rate limited |
| `POST` | `/api/rooms/:code/reactions` | Ephemeral Ably only |
| `POST` | `/api/rooms/:code/presence` | Heartbeat; extends 24h expiry |
| `POST` | `/api/rooms/:code/leave` | Leave; host transfers to oldest active |

See [`API.md`](./API.md) for request/response shapes, error codes, and Ably events.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Vitest (PGlite, no hosted Neon required) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply Drizzle migrations to `DATABASE_URL` |
