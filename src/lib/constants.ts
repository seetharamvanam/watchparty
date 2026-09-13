export const MAX_PARTICIPANTS = 8;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const DISPLAY_NAME_MAX = 32;
export const TITLE_MAX = 120;
export const CHAT_BODY_MAX = 2000;
export const REACTION_MAX = 32;

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 2;
export const MAX_POSITION_MS = 24 * 60 * 60 * 1000;

export { DRIFT_CORRECTION_MS, SYNC_DRIFT_MS } from "./sync-rules";

export const LIVEKIT_TOKEN_TTL_SECONDS = 15 * 60;
export const ABLY_TOKEN_TTL_MS = 15 * 60 * 1000;

export const CHAT_RATE_LIMIT_MAX = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;
export const REACTION_RATE_LIMIT_MAX = 20;
export const REACTION_RATE_LIMIT_WINDOW_MS = 10_000;

export const LIVEKIT_ROOM_PREFIX = "watchparty-";
