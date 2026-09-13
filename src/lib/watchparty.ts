import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type AppDb } from "@/db";
import { chatMessages, participants, playbackStates, rooms, type ParticipantRow, type PlaybackRow, type RoomRow } from "@/db/schema";
import { ablyPlaybackEvent, createAblyTokenRequest, publishRoomEvent } from "./ably";
import { generateRoomCode, isRoomCodeFormat, normalizeRoomCode } from "./codes";
import {
  CHAT_BODY_MAX,
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  DISPLAY_NAME_MAX,
  MAX_PARTICIPANTS,
  MAX_PLAYBACK_RATE,
  MAX_POSITION_MS,
  MIN_PLAYBACK_RATE,
  PRESENCE_STALE_MS,
  REACTION_MAX,
  REACTION_RATE_LIMIT_MAX,
  REACTION_RATE_LIMIT_WINDOW_MS,
  ROOM_TTL_MS,
  TITLE_MAX,
} from "./constants";
import {
  forbidden,
  rateLimited,
  roomExpired,
  roomFull,
  roomNotFound,
  unauthorized,
  validationError,
} from "./errors";
import { mintAvToken } from "./livekit";
import { validateMediaUrl } from "./media";
import { serializePlayback } from "./playback";
import { checkRateLimit } from "./rate-limit";
import { sanitizeChatBody, sanitizeReaction } from "./sanitize";
import { serializeChatMessage, serializeParticipant, serializeRoom } from "./serialize";
import { createSessionToken, hashSessionToken, readBearerToken } from "./session";
import type {
  AvTokenPayload,
  JoinPayload,
  ParticipantPublic,
  PlaybackAction,
  RoomView,
  SessionPayload,
} from "./types";

const displayNameSchema = z.string().trim().min(1, "displayName is required").max(DISPLAY_NAME_MAX);
const titleSchema = z.string().trim().max(TITLE_MAX).optional();

const createRoomSchema = z.object({
  displayName: displayNameSchema,
  mediaUrl: z.string().optional(),
  title: titleSchema,
});

const joinRoomSchema = z.object({
  code: z.string().trim().min(1, "code is required"),
  displayName: displayNameSchema,
});

const mediaSchema = z.object({
  mediaUrl: z.string().min(1, "mediaUrl is required"),
});

const playbackSchema = z.object({
  action: z.enum(["play", "pause", "seek", "rate", "change_media"]),
  positionMs: z.number().int().min(0).max(MAX_POSITION_MS).optional(),
  playbackRate: z.number().min(MIN_PLAYBACK_RATE).max(MAX_PLAYBACK_RATE).optional(),
  mediaUrl: z.string().optional(),
});

const chatSchema = z.object({
  body: z.string().min(1, "body is required").max(CHAT_BODY_MAX + 256),
});

const reactionSchema = z.object({
  emoji: z.string().min(1, "emoji is required").max(REACTION_MAX + 64),
});

const realtimeTokenSchema = z.object({
  code: z.string().trim().min(1, "code is required"),
});

type RoomContext = {
  room: RoomRow;
  playback: PlaybackRow;
  active: ParticipantRow[];
};

type DbTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

function nowPlusTtl(from = new Date()): Date {
  return new Date(from.getTime() + ROOM_TTL_MS);
}

function assertNotExpired(room: RoomRow) {
  if (room.expiresAt.getTime() <= Date.now()) {
    throw roomExpired();
  }
}

async function uniqueRoomCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateRoomCode();
    const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (existing.length === 0) {
      return code;
    }
  }
  throw new Error("Unable to allocate a unique room code");
}

async function loadRoomByCode(code: string): Promise<RoomRow> {
  const normalized = normalizeRoomCode(code);
  if (!isRoomCodeFormat(normalized)) {
    throw roomNotFound();
  }
  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.code, normalized)).limit(1);
  if (!room) {
    throw roomNotFound();
  }
  assertNotExpired(room);
  return room;
}

async function loadContext(code: string): Promise<RoomContext> {
  const room = await loadRoomByCode(code);
  const db = getDb();
  const [playback] = await db.select().from(playbackStates).where(eq(playbackStates.roomId, room.id)).limit(1);
  if (!playback) {
    throw roomNotFound("Playback state missing for room");
  }
  const active = await db
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, room.id), isNull(participants.leftAt)))
    .orderBy(asc(participants.joinedAt));
  return { room, playback, active };
}

async function findParticipantByToken(token: string): Promise<ParticipantRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(participants)
    .where(eq(participants.sessionTokenHash, hashSessionToken(token)))
    .limit(1);
  return row ?? null;
}

export async function requireSession(req: Request, code?: string): Promise<{
  token: string;
  participant: ParticipantRow;
  room: RoomRow;
}> {
  const token = readBearerToken(req);
  if (!token) {
    throw unauthorized();
  }
  const participant = await findParticipantByToken(token);
  if (!participant || participant.leftAt) {
    throw unauthorized();
  }
  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, participant.roomId)).limit(1);
  if (!room) {
    throw roomNotFound();
  }
  assertNotExpired(room);
  if (code && room.code !== normalizeRoomCode(code)) {
    throw forbidden("Session does not belong to this room");
  }
  return { token, participant, room };
}

function requireHost(participant: ParticipantRow) {
  if (!participant.isHost) {
    throw forbidden("Only the host can perform this action");
  }
}

function roomStateSnapshot(ctx: RoomContext, now = new Date()) {
  return {
    type: "state_snapshot" as const,
    room: serializeRoom(ctx.room, ctx.active.length),
    participants: ctx.active.map(serializeParticipant),
    playback: serializePlayback(ctx.playback, now),
    serverNow: now.toISOString(),
  };
}

/**
 * Soft disconnect + host handoff. Marks silent participants left, then ensures
 * exactly one active host (oldest remaining). No kick/mute/lock controls.
 */
async function settlePresence(
  tx: DbTx,
  roomId: string,
  now: Date,
): Promise<{ departed: ParticipantRow[]; newHost: ParticipantRow | null }> {
  const staleBefore = new Date(now.getTime() - PRESENCE_STALE_MS);
  const stale = await tx
    .select()
    .from(participants)
    .where(
      and(eq(participants.roomId, roomId), isNull(participants.leftAt), lt(participants.lastSeenAt, staleBefore)),
    );

  const departed: ParticipantRow[] = [];
  for (const row of stale) {
    await tx
      .update(participants)
      .set({ leftAt: now, isHost: false, lastSeenAt: row.lastSeenAt })
      .where(eq(participants.id, row.id));
    departed.push(row);
  }

  const active = await tx
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, roomId), isNull(participants.leftAt)))
    .orderBy(asc(participants.joinedAt));

  if (active.length === 0) {
    return { departed, newHost: null };
  }

  const intended = active[0];
  const extras = active.filter((row) => row.isHost && row.id !== intended.id);
  if (intended.isHost && extras.length === 0) {
    return { departed, newHost: null };
  }

  await tx.update(participants).set({ isHost: false }).where(eq(participants.roomId, roomId));
  await tx.update(participants).set({ isHost: true }).where(eq(participants.id, intended.id));
  return { departed, newHost: { ...intended, isHost: true } };
}

async function publishPresenceHandoff(
  code: string,
  departed: ParticipantRow[],
  newHost: ParticipantRow | null,
) {
  for (const row of departed) {
    await publishRoomEvent(code, "participant_left", {
      type: "participant_left",
      participantId: row.id,
      displayName: row.displayName,
    });
  }
  if (newHost) {
    await publishRoomEvent(code, "host_changed", {
      type: "host_changed",
      host: serializeParticipant(newHost),
    });
    await publishRoomEvent(code, "state_snapshot", roomStateSnapshot(await loadContext(code)));
  }
}

/**
 * Serialize host playback/media writes against the room row so leave+transfer
 * cannot overlap a mutation (at most one host can command).
 */
async function mutateAsHost<T>(
  req: Request,
  code: string,
  fn: (ctx: { tx: DbTx; room: RoomRow; participant: ParticipantRow; playback: PlaybackRow }) => Promise<T>,
): Promise<T> {
  const token = readBearerToken(req);
  if (!token) {
    throw unauthorized();
  }
  const normalized = normalizeRoomCode(code);
  if (!isRoomCodeFormat(normalized)) {
    throw roomNotFound();
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.code, normalized)).for("update");
    if (!room) {
      throw roomNotFound();
    }
    assertNotExpired(room);

    const [participant] = await tx
      .select()
      .from(participants)
      .where(eq(participants.sessionTokenHash, hashSessionToken(token)))
      .limit(1);
    if (!participant || participant.leftAt) {
      throw unauthorized();
    }
    if (participant.roomId !== room.id) {
      throw forbidden("Session does not belong to this room");
    }
    requireHost(participant);

    const [playback] = await tx.select().from(playbackStates).where(eq(playbackStates.roomId, room.id)).limit(1);
    if (!playback) {
      throw roomNotFound("Playback state missing for room");
    }

    return fn({ tx, room, participant, playback });
  });
}

async function touchPresence(roomId: string, participantId?: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(rooms)
    .set({ lastPresenceAt: now, expiresAt: nowPlusTtl(now) })
    .where(eq(rooms.id, roomId));
  if (participantId) {
    await db.update(participants).set({ lastSeenAt: now }).where(eq(participants.id, participantId));
  }
}

async function sessionResponse(room: RoomRow, participant: ParticipantRow, sessionToken: string): Promise<SessionPayload> {
  const ctx = await loadContext(room.code);
  return {
    room: serializeRoom(ctx.room, ctx.active.length),
    participant: serializeParticipant(participant),
    sessionToken,
    playback: serializePlayback(ctx.playback),
  };
}

export async function createRoom(input: unknown): Promise<SessionPayload> {
  const body = createRoomSchema.parse(input);
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  if (body.mediaUrl) {
    const validated = validateMediaUrl(body.mediaUrl);
    mediaUrl = validated.mediaUrl;
    mediaType = validated.mediaType;
  }

  const db = getDb();
  const now = new Date();
  const roomId = randomUUID();
  const participantId = randomUUID();
  const sessionToken = createSessionToken();
  const code = await uniqueRoomCode();

  await db.transaction(async (tx) => {
    await tx.insert(rooms).values({
      id: roomId,
      code,
      title: body.title?.length ? body.title : null,
      createdAt: now,
      expiresAt: nowPlusTtl(now),
      lastPresenceAt: now,
    });
    await tx.insert(participants).values({
      id: participantId,
      roomId,
      displayName: body.displayName,
      isHost: true,
      sessionTokenHash: hashSessionToken(sessionToken),
      joinedAt: now,
      lastSeenAt: now,
    });
    await tx.insert(playbackStates).values({
      roomId,
      status: "paused",
      positionMs: 0,
      playbackRate: 1,
      mediaUrl,
      mediaType,
      updatedAt: now,
    });
  });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const [participant] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  if (!room || !participant) {
    throw new Error("Failed to create room");
  }

  await publishRoomEvent(code, "state_snapshot", {
    type: "state_snapshot",
    room: serializeRoom(room, 1),
    participants: [serializeParticipant(participant)],
    playback: serializePlayback({
      roomId,
      status: "paused",
      positionMs: 0,
      playbackRate: 1,
      mediaUrl,
      mediaType,
      updatedAt: now,
    }, now),
    serverNow: now.toISOString(),
  });

  return sessionResponse(room, participant, sessionToken);
}

export async function joinRoom(input: unknown): Promise<JoinPayload> {
  const body = joinRoomSchema.parse(input);
  const code = normalizeRoomCode(body.code);
  if (!isRoomCodeFormat(code)) {
    throw roomNotFound();
  }

  const db = getDb();
  const sessionToken = createSessionToken();
  const participantId = randomUUID();
  const now = new Date();

  const joined = await db.transaction(async (tx) => {
    // Serialize joins on the room row so two concurrent requests cannot both
    // see count < 8 and insert a 9th participant. The FOR UPDATE lock is held
    // until this transaction commits.
    const [room] = await tx.select().from(rooms).where(eq(rooms.code, code)).for("update");
    if (!room) {
      throw roomNotFound();
    }
    if (room.expiresAt.getTime() <= Date.now()) {
      throw roomExpired();
    }

    const settled = await settlePresence(tx, room.id, now);

    const [countRow] = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(participants)
      .where(and(eq(participants.roomId, room.id), isNull(participants.leftAt)));
    const count = Number(countRow?.count ?? 0);
    if (count >= MAX_PARTICIPANTS) {
      throw roomFull();
    }

    await tx.insert(participants).values({
      id: participantId,
      roomId: room.id,
      displayName: body.displayName,
      isHost: false,
      sessionTokenHash: hashSessionToken(sessionToken),
      joinedAt: now,
      lastSeenAt: now,
    });
    await tx.update(rooms).set({ lastPresenceAt: now, expiresAt: nowPlusTtl(now) }).where(eq(rooms.id, room.id));

    return { room, settled };
  });

  const [participant] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  if (!participant) {
    throw new Error("Failed to join room");
  }

  await publishPresenceHandoff(joined.room.code, joined.settled.departed, joined.settled.newHost);

  const ctx = await loadContext(joined.room.code);
  const publicParticipants = ctx.active.map(serializeParticipant);
  const me = publicParticipants.find((row) => row.id === participant.id) ?? serializeParticipant(participant);

  await publishRoomEvent(joined.room.code, "participant_joined", {
    type: "participant_joined",
    participant: me,
    participantCount: ctx.active.length,
  });
  await publishRoomEvent(joined.room.code, "state_snapshot", roomStateSnapshot(ctx));

  return {
    room: serializeRoom(ctx.room, ctx.active.length),
    participant: me,
    sessionToken,
    playback: serializePlayback(ctx.playback),
    participants: publicParticipants,
  };
}

export async function getRoomView(req: Request, code: string): Promise<RoomView> {
  const ctx = await loadContext(code);
  let participant: ParticipantPublic | null = null;

  const token = readBearerToken(req);
  if (token) {
    const session = await requireSession(req, ctx.room.code);
    participant = serializeParticipant(session.participant);
  }

  return {
    room: serializeRoom(ctx.room, ctx.active.length),
    participants: ctx.active.map(serializeParticipant),
    playback: serializePlayback(ctx.playback),
    participant,
  };
}

async function updatePlayback(
  db: AppDb | DbTx,
  roomId: string,
  patch: Partial<PlaybackRow> & { updatedAt: Date },
): Promise<PlaybackRow> {
  const [row] = await db.update(playbackStates).set(patch).where(eq(playbackStates.roomId, roomId)).returning();
  if (!row) {
    throw roomNotFound("Playback state missing for room");
  }
  return row;
}

export async function setRoomMedia(req: Request, code: string, input: unknown) {
  const body = mediaSchema.parse(input);
  const validated = validateMediaUrl(body.mediaUrl);
  const now = new Date();

  const { room, participant, playback } = await mutateAsHost(req, code, async ({ tx, room, participant }) => {
    const playback = await updatePlayback(tx, room.id, {
      mediaUrl: validated.mediaUrl,
      mediaType: validated.mediaType,
      status: "paused",
      positionMs: 0,
      updatedAt: now,
    });
    return { room, participant, playback };
  });

  await publishRoomEvent(room.code, "change_media", ablyPlaybackEvent("change_media", playback, participant.id));
  return { room: serializeRoom(room, (await loadContext(room.code)).active.length), playback: serializePlayback(playback) };
}

export async function controlPlayback(req: Request, code: string, input: unknown) {
  const body = playbackSchema.parse(input);
  const action = body.action as PlaybackAction;

  const { room, participant, playback } = await mutateAsHost(req, code, async ({ tx, room, participant, playback: current }) => {
    const now = new Date();
    const patch: Partial<PlaybackRow> & { updatedAt: Date } = { updatedAt: now };

    switch (action) {
      case "play":
        patch.status = "playing";
        patch.positionMs = body.positionMs ?? current.positionMs;
        break;
      case "pause":
        patch.status = "paused";
        patch.positionMs = body.positionMs ?? current.positionMs;
        break;
      case "seek":
        if (body.positionMs === undefined) {
          throw validationError("positionMs is required for seek");
        }
        patch.positionMs = body.positionMs;
        break;
      case "rate":
        if (body.playbackRate === undefined) {
          throw validationError("playbackRate is required for rate");
        }
        patch.playbackRate = body.playbackRate;
        break;
      case "change_media": {
        if (!body.mediaUrl) {
          throw validationError("mediaUrl is required for change_media");
        }
        const validated = validateMediaUrl(body.mediaUrl);
        patch.mediaUrl = validated.mediaUrl;
        patch.mediaType = validated.mediaType;
        patch.status = "paused";
        patch.positionMs = body.positionMs ?? 0;
        break;
      }
      default:
        throw validationError("Unsupported playback action");
    }

    const playback = await updatePlayback(tx, room.id, patch);
    return { room, participant, playback };
  });

  const eventName = action === "change_media" ? "change_media" : action;
  await publishRoomEvent(room.code, eventName, ablyPlaybackEvent(eventName, playback, participant.id));

  return { playback: serializePlayback(playback) };
}

export async function getPlayback(code: string) {
  const ctx = await loadContext(code);
  return { playback: serializePlayback(ctx.playback) };
}

export async function postChat(req: Request, code: string, input: unknown) {
  const parsed = chatSchema.parse(input);
  const text = sanitizeChatBody(parsed.body);
  const { participant, room } = await requireSession(req, code);

  const allowed = await checkRateLimit(
    `chat:${participant.id}`,
    CHAT_RATE_LIMIT_MAX,
    CHAT_RATE_LIMIT_WINDOW_MS,
  );
  if (!allowed) {
    throw rateLimited("Chat rate limit exceeded");
  }

  const db = getDb();
  const now = new Date();
  const message = {
    id: randomUUID(),
    roomId: room.id,
    participantId: participant.id,
    body: text,
    createdAt: now,
  };
  await db.insert(chatMessages).values(message);

  const publicMessage = serializeChatMessage(message, participant.displayName);
  await publishRoomEvent(room.code, "chat_message", {
    type: "chat_message",
    message: publicMessage,
  });

  return { message: publicMessage };
}

export async function listChat(req: Request, code: string, limit = 50) {
  await requireSession(req, code);
  const ctx = await loadContext(code);
  const db = getDb();
  const rows = await db
    .select({
      message: chatMessages,
      displayName: participants.displayName,
    })
    .from(chatMessages)
    .innerJoin(participants, eq(participants.id, chatMessages.participantId))
    .where(eq(chatMessages.roomId, ctx.room.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return {
    messages: rows
      .slice()
      .reverse()
      .map((row) => serializeChatMessage(row.message, row.displayName)),
  };
}

export async function postReaction(req: Request, code: string, input: unknown) {
  const parsed = reactionSchema.parse(input);
  const emoji = sanitizeReaction(parsed.emoji);
  const { participant, room } = await requireSession(req, code);

  const allowed = await checkRateLimit(
    `reaction:${participant.id}`,
    REACTION_RATE_LIMIT_MAX,
    REACTION_RATE_LIMIT_WINDOW_MS,
  );
  if (!allowed) {
    throw rateLimited("Reaction rate limit exceeded");
  }

  const event = {
    type: "reaction" as const,
    emoji,
    participantId: participant.id,
    displayName: participant.displayName,
    createdAt: new Date().toISOString(),
  };
  await publishRoomEvent(room.code, "reaction", event);
  return { ok: true, reaction: event };
}

export async function heartbeat(req: Request, code: string) {
  const token = readBearerToken(req);
  if (!token) {
    throw unauthorized();
  }
  const normalized = normalizeRoomCode(code);
  if (!isRoomCodeFormat(normalized)) {
    throw roomNotFound();
  }

  const db = getDb();
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.code, normalized)).for("update");
    if (!room) {
      throw roomNotFound();
    }
    assertNotExpired(room);

    const [participant] = await tx
      .select()
      .from(participants)
      .where(eq(participants.sessionTokenHash, hashSessionToken(token)))
      .limit(1);
    if (!participant || participant.leftAt) {
      throw unauthorized();
    }
    if (participant.roomId !== room.id) {
      throw forbidden("Session does not belong to this room");
    }

    await tx
      .update(rooms)
      .set({ lastPresenceAt: now, expiresAt: nowPlusTtl(now) })
      .where(eq(rooms.id, room.id));
    await tx.update(participants).set({ lastSeenAt: now }).where(eq(participants.id, participant.id));

    const settled = await settlePresence(tx, room.id, now);
    const [fresh] = await tx.select().from(participants).where(eq(participants.id, participant.id)).limit(1);
    return { room, participant: fresh ?? participant, settled };
  });

  await publishPresenceHandoff(result.room.code, result.settled.departed, result.settled.newHost);
  const ctx = await loadContext(result.room.code);
  return {
    room: serializeRoom(ctx.room, ctx.active.length),
    participant: serializeParticipant(result.participant),
    expiresAt: ctx.room.expiresAt.toISOString(),
  };
}

export async function leaveRoom(req: Request, code: string) {
  const token = readBearerToken(req);
  if (!token) {
    throw unauthorized();
  }
  const normalized = normalizeRoomCode(code);
  if (!isRoomCodeFormat(normalized)) {
    throw roomNotFound();
  }

  const db = getDb();
  const now = new Date();

  const { left, departed, newHost, roomCode } = await db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.code, normalized)).for("update");
    if (!room) {
      throw roomNotFound();
    }
    assertNotExpired(room);

    const [participant] = await tx
      .select()
      .from(participants)
      .where(eq(participants.sessionTokenHash, hashSessionToken(token)))
      .for("update");
    if (!participant || participant.leftAt) {
      throw unauthorized();
    }
    if (participant.roomId !== room.id) {
      throw forbidden("Session does not belong to this room");
    }

    await tx
      .update(participants)
      .set({ leftAt: now, isHost: false, lastSeenAt: now })
      .where(eq(participants.id, participant.id));

    const settled = await settlePresence(tx, room.id, now);
    return {
      left: participant,
      departed: settled.departed,
      newHost: settled.newHost,
      roomCode: room.code,
    };
  });

  await publishRoomEvent(roomCode, "participant_left", {
    type: "participant_left",
    participantId: left.id,
    displayName: left.displayName,
  });
  await publishPresenceHandoff(roomCode, departed, newHost);

  return {
    ok: true,
    hostTransferred: Boolean(newHost),
    newHost: newHost ? serializeParticipant(newHost) : null,
  };
}

export async function createRealtimeToken(req: Request, input: unknown) {
  const body = realtimeTokenSchema.parse(input);
  const { participant, room } = await requireSession(req, body.code);
  if (room.code !== normalizeRoomCode(body.code)) {
    throw forbidden("Session does not belong to this room");
  }
  return createAblyTokenRequest(participant.id, room.code);
}

export async function createAvToken(req: Request, code: string): Promise<AvTokenPayload> {
  const { participant, room } = await requireSession(req, code);
  return mintAvToken({
    identity: participant.id,
    displayName: participant.displayName,
    code: room.code,
  });
}

export function parseLimit(url: string): number {
  const value = new URL(url).searchParams.get("limit");
  if (!value) {
    return 50;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw validationError("limit must be a number");
  }
  return parsed;
}
