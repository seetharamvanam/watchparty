/** Shared playback-sync rules. Used by the API, Ably payloads, and the cinema client. */

export const SYNC_DRIFT_MS = 500;

/** @deprecated Prefer SYNC_DRIFT_MS — same 500ms guest correction threshold. */
export const DRIFT_CORRECTION_MS = SYNC_DRIFT_MS;

export function playbackEventId(updatedAt: Date | string): string {
  const ms = typeof updatedAt === "string" ? Date.parse(updatedAt) : updatedAt.getTime();
  return Number.isFinite(ms) ? String(ms) : String(updatedAt);
}

export function estimatedPositionMs(
  playback: { status: string; positionMs: number; playbackRate: number; updatedAt: Date | string },
  now = Date.now(),
): number {
  const updatedAt =
    typeof playback.updatedAt === "string" ? Date.parse(playback.updatedAt) : playback.updatedAt.getTime();
  if (playback.status !== "playing" || !Number.isFinite(updatedAt)) {
    return Math.max(0, playback.positionMs);
  }
  const elapsed = Math.max(0, now - updatedAt);
  return Math.max(0, Math.round(playback.positionMs + elapsed * playback.playbackRate));
}

/**
 * Expected local position for a received snapshot or event.
 * Prefer `estimatedPositionMs` as-of `serverNow` (late-join HTTP / state_snapshot).
 * Incremental play/pause/seek/rate events keep the last-mutation `positionMs` + `updatedAt`.
 */
export function expectedPositionMs(
  playback: {
    status: string;
    positionMs: number;
    playbackRate: number;
    updatedAt: string;
    serverNow?: string;
    estimatedPositionMs?: number;
  },
  now = Date.now(),
): number {
  const rate = playback.status === "playing" ? playback.playbackRate : 0;
  if (typeof playback.estimatedPositionMs === "number" && playback.serverNow) {
    const origin = Date.parse(playback.serverNow);
    if (Number.isFinite(origin)) {
      return Math.max(0, playback.estimatedPositionMs + Math.max(0, now - origin) * rate);
    }
  }
  return estimatedPositionMs(playback, now);
}

export function shouldCorrectDrift(localMs: number, expectedMs: number, threshold = SYNC_DRIFT_MS): boolean {
  return Math.abs(localMs - expectedMs) > threshold;
}

export function parseEventClock(value: string | undefined): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && value.trim() !== "") return asNumber;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Stale if the incoming mutation is older than what we already applied.
 * Prefer numeric `eventId` (millis of last host mutation); fall back to `updatedAt`.
 * Missing clocks are treated as spoof / untrusted and ignored when we already have state.
 */
export function isStalePlaybackClock(
  incoming: { eventId?: string; updatedAt?: string },
  current: { eventId?: string; updatedAt: string },
): boolean {
  const incomingId = parseEventClock(incoming.eventId) ?? parseEventClock(incoming.updatedAt);
  const currentId = parseEventClock(current.eventId) ?? parseEventClock(current.updatedAt);
  if (incomingId === null) {
    return currentId !== null;
  }
  if (currentId === null) return false;
  return incomingId <= currentId;
}
