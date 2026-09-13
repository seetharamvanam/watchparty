import { ApiError } from "@/lib/client/errors";
import { getApiBase } from "@/lib/client/config";
import type {
  PlaybackRequest,
  ReactionEmoji,
  RealtimeTokenResponse,
  WatchPartyApi,
} from "@/lib/client/api-types";
import type { AvTokenPayload, ChatMessagePublic, JoinPayload, PlaybackState, RoomPublic, RoomView, SessionPayload, ParticipantPublic } from "@/lib/types";

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const base = getApiBase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("CONNECTION_LOST", "Could not reach the Watch Party API.", 503);
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      (body?.error?.code as ApiError["code"]) ?? "UNKNOWN",
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}

export function createHttpApi(): WatchPartyApi {
  return {
    createRoom(input) {
      return request<SessionPayload>("/api/rooms", { method: "POST", body: input });
    },
    joinRoom(input) {
      return request<JoinPayload>("/api/rooms/join", { method: "POST", body: input });
    },
    getRoom(code, token) {
      return request<RoomView>(`/api/rooms/${code}`, { token });
    },
    setMedia(code, mediaUrl, token) {
      return request<{ room: RoomPublic; playback: PlaybackState }>(`/api/rooms/${code}/media`, {
        method: "POST",
        body: { mediaUrl },
        token,
      });
    },
    controlPlayback(code, body: PlaybackRequest, token) {
      return request<{ playback: PlaybackState }>(`/api/rooms/${code}/playback`, {
        method: "POST",
        body,
        token,
      });
    },
    getPlayback(code, token) {
      return request<{ playback: PlaybackState }>(`/api/rooms/${code}/playback`, { token });
    },
    getRealtimeToken(code, token) {
      return request<RealtimeTokenResponse>("/api/realtime/token", {
        method: "POST",
        body: { code },
        token,
      });
    },
    getAvToken(code, token) {
      return request<AvTokenPayload>(`/api/rooms/${code}/av-token`, { method: "POST", token });
    },
    listChat(code, token) {
      return request<{ messages: ChatMessagePublic[] }>(`/api/rooms/${code}/chat?limit=50`, { token });
    },
    sendChat(code, body, token) {
      return request<{ message: ChatMessagePublic }>(`/api/rooms/${code}/chat`, {
        method: "POST",
        body: { body },
        token,
      });
    },
    sendReaction(code, emoji: ReactionEmoji, token) {
      return request<{ ok: true; reaction: { emoji: string; participantId: string; displayName: string; createdAt: string } }>(
        `/api/rooms/${code}/reactions`,
        { method: "POST", body: { emoji }, token },
      );
    },
    heartbeat(code, token) {
      return request<{ room: RoomPublic; participant: ParticipantPublic; expiresAt: string }>(
        `/api/rooms/${code}/presence`,
        { method: "POST", token },
      );
    },
    leave(code, token) {
      return request<{ ok: true; hostTransferred: boolean; newHost: ParticipantPublic | null }>(
        `/api/rooms/${code}/leave`,
        { method: "POST", token },
      );
    },
  };
}
