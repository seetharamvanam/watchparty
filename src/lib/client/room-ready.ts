import type { ChatMessagePublic, RoomView } from "@/lib/types";

export type RoomReadyResult<TConnection> = {
  snapshot: RoomView;
  realtime: TConnection | null;
  realtimeFailed: boolean;
};

/**
 * Fast room-ready path: GET room (authoritative snapshot: room + playback +
 * media + roster) in parallel with the Ably subscribe. Apply the HTTP snapshot
 * first, then drain buffered events so late joiners never start from 0 / stale
 * realtime. Chat is loaded after ready so playback TTI is not blocked.
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
