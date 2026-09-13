# Watch Party API

Locked frontend contract for the Watch Party backend. The server never proxies, fetches, or stores media bytes. Clients load YouTube or direct media themselves. There are no user accounts and no call recording.

Base URL: `NEXT_PUBLIC_APP_URL` (local default `http://localhost:3000`).

## Auth

Create and join issue an opaque participant session token. Send it on subsequent requests:

```
Authorization: Bearer <sessionToken>
```

Tokens are hashed at rest with `SESSION_SECRET`. They are not user accounts.

## Room rules

- Join by a 6-character room code (alphabet `A–Z` excluding `I`/`O`, and `2–9`).
- Maximum **8** participants per room. Join serializes on the room row (`SELECT … FOR UPDATE`) so concurrent joins cannot exceed the cap.
- A room expires **24 hours after the last presence** (create, join, or `POST /presence`).
- Host can set media and control playback. Leaving transfers host to the oldest active participant.

## Shared shapes

### `room`

```json
{
  "id": "uuid",
  "code": "ABC234",
  "title": "Friday movie",
  "expiresAt": "2026-09-14T12:00:00.000Z",
  "participantCount": 2,
  "maxParticipants": 8
}
```

`title` may be `string | null`.

### `participant`

```json
{
  "id": "uuid",
  "displayName": "Ada",
  "isHost": false
}
```

### `playback`

```json
{
  "status": "paused",
  "positionMs": 0,
  "playbackRate": 1,
  "mediaUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "mediaType": "youtube",
  "updatedAt": "2026-09-13T12:00:00.000Z"
}
```

- `status`: `playing` | `paused`
- `mediaType`: `youtube` | `direct` | `null`
- `updatedAt` is the last host mutation. Clients should compute expected position while playing as `positionMs + (now - updatedAt) * playbackRate` and **correct drift greater than 500ms**.

### Error envelope

All errors use:

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room not found"
  }
}
```

| Code | Status | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired session |
| `FORBIDDEN` | 403 | Not host, or session belongs to another room |
| `ROOM_NOT_FOUND` | 404 | Unknown or malformed room code |
| `ROOM_FULL` | 409 | 8 active participants already |
| `ROOM_EXPIRED` | 410 | Past `expiresAt` |
| `INVALID_MEDIA_URL` | 400 | URL is not an allowed YouTube or HTTPS media URL |
| `YOUTUBE_NOT_EMBEDDABLE` | 400 | Shorts, Live, Clips, YouTube Music |
| `VALIDATION_ERROR` | 400 | Bad JSON or field validation |
| `RATE_LIMITED` | 429 | Chat or reaction burst exceeded |

## Media URL rules

The API **never fetches media**. It only inspects the URL string.

Allowed:

- YouTube `watch`, `youtu.be`, and `embed` HTTPS URLs with an 11-character video id
- Direct HTTPS URLs whose path ends in `.mp4`, `.webm`, or `.m3u8`

Rejected:

- `http://` (must be HTTPS)
- YouTube Shorts / Live / Clips / Music → `YOUTUBE_NOT_EMBEDDABLE`
- Any other host/path → `INVALID_MEDIA_URL`

## Endpoints

### `POST /api/rooms`

Create a room. The creator is the host.

Request:

```json
{
  "displayName": "Ada",
  "mediaUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Friday movie"
}
```

`mediaUrl` and `title` are optional. `displayName` is required (1–32 chars).

Response `201`:

```json
{
  "room": {},
  "participant": {},
  "sessionToken": "opaque-token",
  "playback": {}
}
```

### `POST /api/rooms/join`

Join an existing room.

Request:

```json
{
  "code": "ABC234",
  "displayName": "Ben"
}
```

Response `200` — same as create, plus `participants[]`:

```json
{
  "room": {},
  "participant": {},
  "sessionToken": "opaque-token",
  "playback": {},
  "participants": []
}
```

Errors: `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_EXPIRED`, `VALIDATION_ERROR`.

### `GET /api/rooms/:code`

Public room snapshot. If `Authorization` is sent, `participant` is the caller; otherwise `participant` is `null`.

Response `200`:

```json
{
  "room": {},
  "participants": [],
  "playback": {},
  "participant": {}
}
```

Errors: `ROOM_NOT_FOUND`, `ROOM_EXPIRED`, `UNAUTHORIZED` (invalid bearer token).

### `POST /api/rooms/:code/media`

Host only. Sets the room media URL, pauses, and resets position to `0`.

Request:

```json
{ "mediaUrl": "https://cdn.example.com/movie.mp4" }
```

Response `200`: `{ "room": {}, "playback": {} }`

### `POST /api/rooms/:code/playback`

Host only.

Request:

```json
{
  "action": "play",
  "positionMs": 1500,
  "playbackRate": 1,
  "mediaUrl": "https://cdn.example.com/movie.mp4"
}
```

| Action | Required fields | Effect |
| --- | --- | --- |
| `play` | | `status=playing`; optional `positionMs` |
| `pause` | | `status=paused`; optional `positionMs` |
| `seek` | `positionMs` | Updates position; keeps status |
| `rate` | `playbackRate` | `0.25`–`2` |
| `change_media` | `mediaUrl` | Validates URL, pauses, resets position unless `positionMs` is sent |

Response `200`: `{ "playback": {} }`

Publishes the matching Ably event (`play` / `pause` / `seek` / `rate` / `change_media`).

### `GET /api/rooms/:code/playback`

Response `200`: `{ "playback": {} }`

### `POST /api/realtime/token`

Requires session. Body: `{ "code": "ABC234" }`.

Returns an Ably token request scoped to channel `room:{code}`.

**Clients are subscribe-only.** Capability is `subscribe`, `presence`, and `history`. Tokens **never** include `publish`. Guests cannot spoof playback, host, chat, or reactions on the channel. The server publishes every authoritative event with `ABLY_API_KEY`.

```json
{
  "tokenRequest": {
    "keyName": "...",
    "ttl": 900000,
    "capability": "{\"room:ABC234\":[\"subscribe\",\"presence\",\"history\"]}",
    "clientId": "<participantId>",
    "timestamp": 0,
    "nonce": "...",
    "mac": "..."
  },
  "channel": "room:ABC234"
}
```

### `POST /api/rooms/:code/av-token`

Requires session. Mints a **short-lived** LiveKit token (15 minutes). Recording grants are never included.

Response `200`:

```json
{
  "token": "<jwt>",
  "url": "<NEXT_PUBLIC_LIVEKIT_URL>",
  "roomName": "watchparty-ABC234",
  "identity": "<participantId>",
  "expiresAt": "2026-09-13T12:15:00.000Z"
}
```

`url` is exactly `NEXT_PUBLIC_LIVEKIT_URL`. `roomName` is `watchparty-{code}`. `identity` is the participant id.

### Chat (persisted + rate limited)

`POST /api/rooms/:code/chat` — session required.

```json
{ "body": "this scene is wild" }
```

Response `201`: `{ "message": { "id", "participantId", "displayName", "body", "createdAt" } }`

Bodies are sanitized: HTML tags and `<>` are stripped, control / zero-width characters are removed, then empty or oversized results are rejected (`VALIDATION_ERROR`).

Limit: **5 messages / 10 seconds / participant**. Excess → `RATE_LIMITED`. Limits are stored in Neon (`rate_limit_events` + locked `rate_limit_buckets` rows) so they work across serverless isolates.

`GET /api/rooms/:code/chat` — session required. Optional `?limit=50` (1–100). Returns `{ "messages": [] }` oldest-first.

### Reactions (ephemeral Ably only)

`POST /api/rooms/:code/reactions` — session required.

```json
{ "emoji": "🔥" }
```

Not persisted. The **server** publishes `reaction` on `room:{code}` (clients cannot publish). Response `{ "ok": true, "reaction": { ... } }`.

Emoji/text is sanitized the same way as chat (no HTML, no control chars). Empty-after-sanitize → `VALIDATION_ERROR`.

Limit: **20 reactions / 10 seconds / participant** (same durable DB limiter).

### Presence heartbeat

`POST /api/rooms/:code/presence` — session required.

Extends `expiresAt` to 24 hours from now and updates the participant's `lastSeenAt`.

Response: `{ "room", "participant", "expiresAt" }`.

### Leave + host transfer

`POST /api/rooms/:code/leave` — session required.

Marks the caller as left. If they were host, the **oldest active** participant (earliest `joinedAt`) becomes host and Ably emits `host_changed`.

Response:

```json
{
  "ok": true,
  "hostTransferred": true,
  "newHost": { "id": "...", "displayName": "...", "isHost": true }
}
```

## Ably channel `room:{code}`

Clients subscribe (and may use presence/history) with the token from `POST /api/realtime/token`. They **must not** and **cannot** publish. The API server publishes all of the following events with the Ably REST API key:

| Event | When |
| --- | --- |
| `play` | Host started playback |
| `pause` | Host paused |
| `seek` | Host seeked |
| `rate` | Host changed rate |
| `change_media` | Host changed media URL |
| `state_snapshot` | Room created / participant joined (full room + playback + roster) |
| `participant_joined` | Someone joined |
| `participant_left` | Someone left |
| `host_changed` | Host transferred |
| `room_expired` | Reserved for expiry notices |
| `chat_message` | Persisted chat |
| `reaction` | Ephemeral reaction |

Playback events include `positionMs`, `playbackRate`, `updatedAt`, `serverNow`, and `driftCorrectionMs: 500`. Clients must resync when local drift exceeds 500ms.

## LiveKit

- Room name: `watchparty-{code}`
- Identity: participant id
- Purpose: camera + microphone only
- **No recording.** Tokens omit recorder/room-record grants.
- The API never proxies A/V media.

## Environment

Server (never expose to the client):

- `DATABASE_URL`
- `ABLY_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `SESSION_SECRET`

Public:

- `NEXT_PUBLIC_LIVEKIT_URL`
- `NEXT_PUBLIC_APP_URL`
