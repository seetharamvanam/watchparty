import { isMockApi } from "@/lib/client/config";
import { subscribeMockEvents } from "@/lib/client/mock-bus";
import type { RealtimeTokenResponse, WatchPartyApi } from "@/lib/client/api-types";
import type { RealtimeConnection, RoomEvent } from "@/lib/client/room-events";

export type { RealtimeConnection, RoomEvent } from "@/lib/client/room-events";
export { isStalePlaybackEvent, playbackFromEvent } from "@/lib/client/room-events";

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
