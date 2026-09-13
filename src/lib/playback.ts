import type { PlaybackRow } from "@/db/schema";
import type { PlaybackState, PlaybackStatus } from "@/lib/types";
import { estimatedPositionMs, playbackEventId } from "@/lib/sync-rules";

export { estimatedPositionMs, playbackEventId } from "@/lib/sync-rules";

export function serializePlayback(playback: PlaybackRow, now = new Date()): PlaybackState {
  const asOf = now.getTime();
  return {
    status: playback.status as PlaybackStatus,
    positionMs: playback.positionMs,
    playbackRate: playback.playbackRate,
    mediaUrl: playback.mediaUrl,
    mediaType: (playback.mediaType as PlaybackState["mediaType"]) ?? null,
    updatedAt: playback.updatedAt.toISOString(),
    serverNow: now.toISOString(),
    estimatedPositionMs: estimatedPositionMs(playback, asOf),
    eventId: playbackEventId(playback.updatedAt),
  };
}
