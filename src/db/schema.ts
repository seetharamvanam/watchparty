import { boolean, index, integer, pgTable, real, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastPresenceAt: timestamp("last_presence_at", { withTimezone: true }).notNull(),
});

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    isHost: boolean("is_host").notNull().default(false),
    sessionTokenHash: text("session_token_hash").notNull().unique(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    index("participants_room_id_idx").on(table.roomId),
    index("participants_session_token_hash_idx").on(table.sessionTokenHash),
  ],
);

export const playbackStates = pgTable("playback_states", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("paused"),
  positionMs: integer("position_ms").notNull().default(0),
  playbackRate: real("playback_rate").notNull().default(1),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_messages_room_created_idx").on(table.roomId, table.createdAt)],
);

export type RoomRow = typeof rooms.$inferSelect;
export type ParticipantRow = typeof participants.$inferSelect;
export type PlaybackRow = typeof playbackStates.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
