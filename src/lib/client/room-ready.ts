import type { ChatMessagePublic, RoomView } from "@/lib/types";

export type RoomReadyResult<TConnection> = {
  snapshot: RoomView;
  realtime: TConnection | null;
  realtimeFailed: boolean;
};

/**
 * Fast room-ready path: HTTP snapshot (room + playback + roster) in parallel
 * with the realtime subscribe. Chat is not part of this — load it after ready
 * so playback TTI is not blocked.
 */
export async function loadRoomReady<TConnection extends { close: () => void }>(options: {
  getSnapshot: () => Promise<RoomView>;
  connectRealtime: () => Promise<TConnection>;
}): Promise<RoomReadyResult<TConnection>> {
  const [snapResult, realtimeResult] = await Promise.allSettled([
    options.getSnapshot(),
    options.connectRealtime(),
  ]);

  if (snapResult.status === "rejected") {
    if (realtimeResult.status === "fulfilled") {
      realtimeResult.value.close();
    }
    throw snapResult.reason;
  }

  if (realtimeResult.status === "fulfilled") {
    return {
      snapshot: snapResult.value,
      realtime: realtimeResult.value,
      realtimeFailed: false,
    };
  }

  return {
    snapshot: snapResult.value,
    realtime: null,
    realtimeFailed: true,
  };
}

export async function loadChatAfterReady(
  load: () => Promise<{ messages: ChatMessagePublic[] }>,
): Promise<ChatMessagePublic[]> {
  try {
    const { messages } = await load();
    return messages;
  } catch {
    return [];
  }
}
