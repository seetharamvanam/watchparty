import { isMockApi } from "@/lib/client/config";
import { subscribeMockEvents } from "@/lib/client/mock-bus";
import type { RealtimeTokenResponse, WatchPartyApi } from "@/lib/client/api-types";
import type { ChatMessagePublic, ParticipantPublic, PlaybackState, RoomPublic } from "@/lib/types";

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

/** Subscribe-only. Clients never publish; the API server publishes with ABLY_API_KEY. */
export interface RealtimeConnection {
  subscribe(handler: (event: RoomEvent) => void): () => void;
  close(): void;
}

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

function connectMock(roomCode: string): RealtimeConnection {
  const code = roomCode.toUpperCase();
  return {
    subscribe(handler) {
      return subscribeMockEvents((event) => {
        if ((event as { roomCode?: string }).roomCode?.toUpperCase() === code) {
          handler(event as RoomEvent);
        }
      });
    },
    close() {},
  };
}

export async function connectAbly(roomCode: string, token: RealtimeTokenResponse): Promise<RealtimeConnection> {
  const Ably = await import("ably");
  const client = new Ably.Realtime({
    clientId: token.clientId,
    authCallback: token.tokenRequest
      ? (_params, callback) => {
          callback(null, token.tokenRequest as never);
        }
      : token.token
        ? (_params, callback) => {
            callback(null, token.token as never);
          }
        : undefined,
  });
  const channelName = token.channel || `room:${roomCode.toUpperCase()}`;
  const channel = client.channels.get(channelName);
  await channel.attach();

  return {
    subscribe(handler) {
      const listener = (message: { data?: RoomEvent; name?: string }) => {
        const data = message.data;
        if (!data) return;
        handler({ ...data, type: data.type || message.name || "" });
      };
      channel.subscribe(listener);
      return () => channel.unsubscribe(listener);
    },
    close() {
      void channel.detach();
      client.close();
    },
  };
}

export async function connectRealtime(
  api: WatchPartyApi,
  code: string,
  sessionToken: string,
): Promise<RealtimeConnection> {
  if (isMockApi()) return connectMock(code);
  const token = await api.getRealtimeToken(code, sessionToken);
  return connectAbly(code, token);
}
