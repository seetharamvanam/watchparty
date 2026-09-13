import { isStalePlaybackClock, playbackEventId } from "@/lib/sync-rules";
import type { ChatMessagePublic, ParticipantPublic, PlaybackState, RoomPublic } from "@/lib/types";

/** Subscribe-only connection. Clients never publish. */
export interface RealtimeConnection {
  subscribe(handler: (event: RoomEvent) => void): () => void;
  close(): void;
}

export type RoomEvent = {
  type: string;
  room?: RoomPublic;
  participants?: ParticipantPublic[];
  playback?: PlaybackState;
  participant?: ParticipantPublic;
  participantId?: string;
  participantCount?: number;
  host?: ParticipantPublic;
  message?: ChatMessagePublic;
  emoji?: string;
  displayName?: string;
  createdAt?: string;
  status?: PlaybackState["status"];
  positionMs?: number;
  playbackRate?: number;
  mediaUrl?: string | null;
  mediaType?: PlaybackState["mediaType"];
  updatedAt?: string;
  serverNow?: string;
  estimatedPositionMs?: number;
  eventId?: string;
  driftCorrectionMs?: number;
};

export function playbackFromEvent(event: RoomEvent, fallback: PlaybackState): PlaybackState {
  if (event.playback) return event.playback;
  if (
    event.type === "play" ||
    event.type === "pause" ||
    event.type === "seek" ||
    event.type === "rate" ||
    event.type === "change_media" ||
    event.type === "state_snapshot"
  ) {
    const incremental = event.type !== "state_snapshot";
    return {
      status: (event.status as PlaybackState["status"]) ?? fallback.status,
      positionMs: event.positionMs ?? fallback.positionMs,
      playbackRate: event.playbackRate ?? fallback.playbackRate,
      mediaUrl: event.mediaUrl !== undefined ? event.mediaUrl : fallback.mediaUrl,
      mediaType: event.mediaType !== undefined ? event.mediaType : fallback.mediaType,
      updatedAt: event.updatedAt ?? fallback.updatedAt,
      serverNow: event.serverNow,
      // Snapshot-only live estimate. Incremental events keep the mutation anchor
      // so we do not keep a stale estimatedPositionMs from the last join snapshot.
      estimatedPositionMs: incremental ? undefined : event.estimatedPositionMs,
      eventId: event.eventId ?? (event.updatedAt ? playbackEventId(event.updatedAt) : fallback.eventId),
    };
  }
  return fallback;
}

/**
 * Ignore realtime playback older than the HTTP snapshot (or a newer mutation)
 * already applied. Events without `eventId`/`updatedAt` are treated as spoof.
 */
export function isStalePlaybackEvent(event: RoomEvent, current: PlaybackState): boolean {
  return isStalePlaybackClock(
    {
      eventId: event.playback?.eventId ?? event.eventId,
      updatedAt: event.playback?.updatedAt ?? event.updatedAt,
    },
    current,
  );
}
