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
  driftCorrectionMs?: number;
};

export function playbackFromEvent(event: RoomEvent, fallback: PlaybackState): PlaybackState {
  if (event.playback) return event.playback;
  if (
    event.type === "play" ||
    event.type === "pause" ||
    event.type === "seek" ||
    event.type === "rate" ||
    event.type === "change_media"
  ) {
    return {
      status: (event.status as PlaybackState["status"]) ?? fallback.status,
      positionMs: event.positionMs ?? fallback.positionMs,
      playbackRate: event.playbackRate ?? fallback.playbackRate,
      mediaUrl: event.mediaUrl !== undefined ? event.mediaUrl : fallback.mediaUrl,
      mediaType: event.mediaType !== undefined ? event.mediaType : fallback.mediaType,
      updatedAt: event.updatedAt ?? fallback.updatedAt,
    };
  }
  return fallback;
}

/** Ignore realtime playback that is older than the HTTP snapshot we already applied. */
export function isStalePlaybackEvent(event: RoomEvent, current: PlaybackState): boolean {
  const incoming = event.playback?.updatedAt ?? event.updatedAt;
  if (!incoming) return false;
  const next = Date.parse(incoming);
  const prev = Date.parse(current.updatedAt);
  return Number.isFinite(next) && Number.isFinite(prev) && next < prev;
}
