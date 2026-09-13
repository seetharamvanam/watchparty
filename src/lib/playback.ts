import type { PlaybackRow } from "@/db/schema";
import type { PlaybackState, PlaybackStatus } from "@/lib/types";

export function estimatedPositionMs(playback: PlaybackRow, now = Date.now()): number {
  if (playback.status !== "playing") {
    return Math.max(0, playback.positionMs);
  }
  const elapsed = Math.max(0, now - playback.updatedAt.getTime());
  return Math.max(0, Math.round(playback.positionMs + elapsed * playback.playbackRate));
}

export function serializePlayback(playback: PlaybackRow): PlaybackState {
  return {
    status: playback.status as PlaybackStatus,
    positionMs: playback.positionMs,
    playbackRate: playback.playbackRate,
    mediaUrl: playback.mediaUrl,
    mediaType: (playback.mediaType as PlaybackState["mediaType"]) ?? null,
    updatedAt: playback.updatedAt.toISOString(),
  };
}
