import { emitMockEvent } from "@/lib/client/mock-bus";
import type { ReactionEmoji, WatchPartyApi } from "@/lib/client/api-types";
import { ApiError, toApiError } from "@/lib/client/errors";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_TTL_MS, MAX_PARTICIPANTS, SYNC_DRIFT_MS } from "@/lib/constants";
import { estimatedPositionMs, playbackEventId } from "@/lib/sync-rules";
import { isRoomCodeFormat, normalizeRoomCode } from "@/lib/client/room-code";
import { validateMediaUrl } from "@/lib/media";
import type {
  ChatMessagePublic,
  ParticipantPublic,
  PlaybackState,
  RoomPublic,
} from "@/lib/types";

const STORAGE_KEY = "watchparty:mock:v1";
const RESERVED_FULL = "FULL88";
const RESERVED_EXPIRED = "ENDED8";

interface MockRoom {
  room: RoomPublic;
  participants: ParticipantPublic[];
  playback: PlaybackState;
  chat: ChatMessagePublic[];
  sessions: Record<string, string>;
}

interface MockDb {
  rooms: Record<string, MockRoom>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function livePlayback(playback: PlaybackState): PlaybackState {
  const now = new Date();
  return {
    ...playback,
    serverNow: now.toISOString(),
    estimatedPositionMs: estimatedPositionMs(playback, now.getTime()),
    eventId: playback.eventId ?? playbackEventId(playback.updatedAt),
  };
}

function emptyPlayback(): PlaybackState {
  const updatedAt = nowIso();
  return livePlayback({
    status: "paused",
    positionMs: 0,
    playbackRate: 1,
    mediaUrl: null,
    mediaType: null,
    updatedAt,
  });
}

function loadDb(): MockDb {
  if (typeof window === "undefined") return { rooms: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockDb) : { rooms: {} };
  } catch {
    return { rooms: {} };
  }
}

function saveDb(db: MockDb): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function uid(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function generateCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

function requireName(displayName: string): string {
  const name = displayName.trim();
  if (name.length < 1 || name.length > 32) {
    throw new ApiError("VALIDATION_ERROR", "Display name must be 1–32 characters.");
  }
  return name;
}

function getRoom(db: MockDb, code: string): MockRoom {
  const record = db.rooms[code];
  if (!record) throw new ApiError("ROOM_NOT_FOUND", "No room found for that code.", 404);
  if (new Date(record.room.expiresAt).getTime() < Date.now()) {
    throw new ApiError("ROOM_EXPIRED", "This room has expired.", 410);
  }
  return record;
}

function auth(record: MockRoom, token?: string): ParticipantPublic {
  if (!token) throw new ApiError("UNAUTHORIZED", "Missing session token.", 401);
  const id = record.sessions[token];
  const participant = record.participants.find((p) => p.id === id);
  if (!participant) throw new ApiError("UNAUTHORIZED", "Invalid session token.", 401);
  return participant;
}

function applyMedia(url: string): PlaybackState {
  try {
    const parsed = validateMediaUrl(url);
    return livePlayback({
      status: "paused",
      positionMs: 0,
      playbackRate: 1,
      mediaUrl: parsed.mediaUrl,
      mediaType: parsed.mediaType,
      updatedAt: nowIso(),
    });
  } catch (error) {
    throw toApiError(error);
  }
}

export function createMockApi(): WatchPartyApi {
  return {
    async createRoom(input) {
      const displayName = requireName(input.displayName);
      const db = loadDb();
      let code = generateCode();
      while (db.rooms[code] || code === RESERVED_FULL || code === RESERVED_EXPIRED) {
        code = generateCode();
      }
      const participant: ParticipantPublic = {
        id: uid("p"),
        displayName,
        isHost: true,
      };
      const token = uid("tok");
      const playback = input.mediaUrl?.trim() ? applyMedia(input.mediaUrl) : emptyPlayback();
      const room: RoomPublic = {
        id: uid("room"),
        code,
        title: input.title?.trim() ? input.title.trim().slice(0, 120) : null,
        expiresAt: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
        participantCount: 1,
        maxParticipants: MAX_PARTICIPANTS,
      };
      db.rooms[code] = {
        room,
        participants: [participant],
        playback,
        chat: [],
        sessions: { [token]: participant.id },
      };
      saveDb(db);
      emitMockEvent({
        type: "state_snapshot",
        roomCode: code,
        room,
        participants: [participant],
        playback,
      });
      return { room, participant, sessionToken: token, playback: livePlayback(playback) };
    },

    async joinRoom(input) {
      const displayName = requireName(input.displayName);
      const code = normalizeRoomCode(input.code);
      if (!isRoomCodeFormat(code)) {
        throw new ApiError("ROOM_NOT_FOUND", "Room not found.", 404);
      }
      if (code === RESERVED_FULL) throw new ApiError("ROOM_FULL", "This room already has 8 people.", 409);
      if (code === RESERVED_EXPIRED) throw new ApiError("ROOM_EXPIRED", "This room has expired.", 410);
      const db = loadDb();
      const record = getRoom(db, code);
      if (record.participants.length >= MAX_PARTICIPANTS) {
        throw new ApiError("ROOM_FULL", "This room already has 8 people.", 409);
      }
      const participant: ParticipantPublic = { id: uid("p"), displayName, isHost: false };
      const token = uid("tok");
      record.participants.push(participant);
      record.sessions[token] = participant.id;
      record.room.participantCount = record.participants.length;
      saveDb(db);
      emitMockEvent({
        type: "participant_joined",
        roomCode: code,
        participant,
        participantCount: record.room.participantCount,
      });
      emitMockEvent({
        type: "state_snapshot",
        roomCode: code,
        room: record.room,
        participants: record.participants,
        playback: livePlayback(record.playback),
      });
      return {
        room: record.room,
        participant,
        sessionToken: token,
        playback: livePlayback(record.playback),
        participants: [...record.participants],
      };
    },

    async getRoom(code, token) {
      const normalized = normalizeRoomCode(code);
      if (normalized === RESERVED_FULL) throw new ApiError("ROOM_FULL", "This room already has 8 people.", 409);
      if (normalized === RESERVED_EXPIRED) throw new ApiError("ROOM_EXPIRED", "This room has expired.", 410);
      const db = loadDb();
      const record = getRoom(db, normalized);
      const participant = token ? auth(record, token) : null;
      return {
        room: record.room,
        participants: [...record.participants],
        playback: livePlayback(record.playback),
        participant,
      };
    },

    async setMedia(code, mediaUrl, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const actor = auth(record, token);
      if (!actor.isHost) throw new ApiError("FORBIDDEN", "Only the host can change the movie.", 403);
      record.playback = applyMedia(mediaUrl);
      saveDb(db);
      emitMockEvent({
        type: "change_media",
        roomCode: record.room.code,
        ...record.playback,
        actorParticipantId: actor.id,
        eventId: record.playback.eventId ?? playbackEventId(record.playback.updatedAt),
        driftCorrectionMs: SYNC_DRIFT_MS,
        serverNow: nowIso(),
      });
      return { room: record.room, playback: livePlayback(record.playback) };
    },

    async controlPlayback(code, body, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const actor = auth(record, token);
      if (!actor.isHost) throw new ApiError("FORBIDDEN", "Only the host can control playback.", 403);
      const next = { ...record.playback, updatedAt: nowIso() };
      if (body.action === "change_media") {
        if (!body.mediaUrl) throw new ApiError("VALIDATION_ERROR", "mediaUrl is required.");
        record.playback = applyMedia(body.mediaUrl);
      } else {
        if (!next.mediaUrl) throw new ApiError("VALIDATION_ERROR", "Nothing is queued to play yet.");
        if (body.action === "play") next.status = "playing";
        if (body.action === "pause") next.status = "paused";
        if (body.action === "seek") {
          if (typeof body.positionMs !== "number") throw new ApiError("VALIDATION_ERROR", "positionMs is required.");
          next.positionMs = body.positionMs;
        }
        if (body.action === "rate") {
          if (typeof body.playbackRate !== "number") throw new ApiError("VALIDATION_ERROR", "playbackRate is required.");
          next.playbackRate = body.playbackRate;
        }
        if (typeof body.positionMs === "number" && body.action !== "seek") next.positionMs = body.positionMs;
        record.playback = livePlayback(next);
      }
      saveDb(db);
      emitMockEvent({
        type: body.action,
        roomCode: record.room.code,
        ...record.playback,
        eventId: record.playback.eventId ?? playbackEventId(record.playback.updatedAt),
        driftCorrectionMs: SYNC_DRIFT_MS,
        serverNow: nowIso(),
        actorParticipantId: actor.id,
      });
      return { playback: livePlayback(record.playback) };
    },

    async getPlayback(code, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      auth(record, token);
      return { playback: livePlayback(record.playback) };
    },

    async getRealtimeToken(code, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const participant = auth(record, token);
      return {
        tokenRequest: { clientId: participant.id },
        channel: `room:${record.room.code}`,
        clientId: participant.id,
      };
    },

    async getAvToken(code, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const participant = auth(record, token);
      return {
        token: `mock-livekit-${token}`,
        url: "mock://livekit",
        roomName: `watchparty-${record.room.code}`,
        identity: participant.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    },

    async listChat(code, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      auth(record, token);
      return { messages: [...record.chat] };
    },

    async sendChat(code, body, token) {
      const text = body.trim();
      if (!text) throw new ApiError("VALIDATION_ERROR", "Message is required.");
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const actor = auth(record, token);
      const message: ChatMessagePublic = {
        id: uid("msg"),
        participantId: actor.id,
        displayName: actor.displayName,
        body: text,
        createdAt: nowIso(),
      };
      record.chat.push(message);
      saveDb(db);
      emitMockEvent({ type: "chat_message", roomCode: record.room.code, message });
      return { message };
    },

    async sendReaction(code, emoji: ReactionEmoji, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const actor = auth(record, token);
      const reaction = {
        emoji,
        participantId: actor.id,
        displayName: actor.displayName,
        createdAt: nowIso(),
      };
      emitMockEvent({ type: "reaction", roomCode: record.room.code, ...reaction });
      return { ok: true as const, reaction };
    },

    async heartbeat(code, token) {
      const db = loadDb();
      const record = getRoom(db, normalizeRoomCode(code));
      const participant = auth(record, token);
      record.room.expiresAt = new Date(Date.now() + ROOM_TTL_MS).toISOString();
      saveDb(db);
      return { room: record.room, participant, expiresAt: record.room.expiresAt };
    },

    async leave(code, token) {
      const db = loadDb();
      const normalized = normalizeRoomCode(code);
      const record = db.rooms[normalized];
      if (!record) return { ok: true as const, hostTransferred: false, newHost: null };
      let actor: ParticipantPublic;
      try {
        actor = auth(record, token);
      } catch {
        return { ok: true as const, hostTransferred: false, newHost: null };
      }
      delete record.sessions[token];
      record.participants = record.participants.filter((p) => p.id !== actor.id);
      record.room.participantCount = record.participants.length;
      let newHost: ParticipantPublic | null = null;
      if (actor.isHost && record.participants[0]) {
        newHost = { ...record.participants[0], isHost: true };
        record.participants = record.participants.map((p, i) => ({ ...p, isHost: i === 0 }));
      }
      saveDb(db);
      emitMockEvent({
        type: "participant_left",
        roomCode: normalized,
        participantId: actor.id,
        displayName: actor.displayName,
      });
      if (newHost) {
        emitMockEvent({ type: "host_changed", roomCode: normalized, host: newHost });
      }
      return { ok: true as const, hostTransferred: Boolean(newHost), newHost };
    },
  };
}
