import type { ErrorCode } from "@/lib/errors";
import { AppError } from "@/lib/errors";

export type ClientErrorCode = ErrorCode | "CONNECTION_LOST" | "AV_UNAVAILABLE" | "UNKNOWN";

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;

  constructor(code: ClientErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AppError) {
    return new ApiError(error.code, error.message, error.status);
  }
  if (error instanceof Error) return new ApiError("UNKNOWN", error.message);
  return new ApiError("UNKNOWN", "Something went wrong");
}

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export const ERROR_COPY: Record<ClientErrorCode, { title: string; body: string }> = {
  ROOM_NOT_FOUND: {
    title: "This party doesn’t exist",
    body: "Double-check the six-character code, or ask the host for a fresh invite.",
  },
  ROOM_FULL: {
    title: "This couch is full",
    body: "Watch Party seats eight people. Ask someone to leave, or start a new room.",
  },
  ROOM_EXPIRED: {
    title: "This party has ended",
    body: "The room expired or the last person left. Create a new one and send a new code.",
  },
  INVALID_MEDIA_URL: {
    title: "That link won’t play here",
    body: "Use an HTTPS YouTube watch / youtu.be / embed link, or a direct .mp4, .webm, or .m3u8.",
  },
  YOUTUBE_NOT_EMBEDDABLE: {
    title: "YouTube won’t embed this video",
    body: "Shorts, Live, Clips, and YouTube Music are blocked. Try a regular watch link.",
  },
  UNAUTHORIZED: {
    title: "Session expired",
    body: "Rejoin the room with your name and the room code.",
  },
  FORBIDDEN: {
    title: "Only the host can do that",
    body: "Playback stays with the host so everyone stays in sync.",
  },
  VALIDATION_ERROR: {
    title: "Check that field",
    body: "Something in the form needs a quick fix.",
  },
  RATE_LIMITED: {
    title: "Slow down",
    body: "Chat and reactions are rate limited so the room stays light.",
  },
  AV_UNAVAILABLE: {
    title: "Camera & mic unavailable",
    body: "You can still watch together. Faces will show as avatars until A/V reconnects.",
  },
  CONNECTION_LOST: {
    title: "Connection lost",
    body: "Trying to reconnect. Playback may drift until we’re back.",
  },
  UNKNOWN: {
    title: "Something went sideways",
    body: "Try again in a moment. If it keeps happening, start a new room.",
  },
};
