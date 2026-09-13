CREATE TABLE IF NOT EXISTS "rooms" (
  "id" uuid PRIMARY KEY,
  "code" varchar(6) NOT NULL UNIQUE,
  "title" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "last_presence_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "participants" (
  "id" uuid PRIMARY KEY,
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "display_name" text NOT NULL,
  "is_host" boolean NOT NULL DEFAULT false,
  "session_token_hash" text NOT NULL UNIQUE,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "left_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "participants_room_id_idx" ON "participants" ("room_id");
CREATE INDEX IF NOT EXISTS "participants_session_token_hash_idx" ON "participants" ("session_token_hash");

CREATE TABLE IF NOT EXISTS "playback_states" (
  "room_id" uuid PRIMARY KEY REFERENCES "rooms"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'paused',
  "position_ms" integer NOT NULL DEFAULT 0,
  "playback_rate" real NOT NULL DEFAULT 1,
  "media_url" text,
  "media_type" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY,
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "participant_id" uuid NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_messages_room_created_idx" ON "chat_messages" ("room_id", "created_at");
