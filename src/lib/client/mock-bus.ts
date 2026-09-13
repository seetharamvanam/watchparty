type Handler = (event: Record<string, unknown>) => void;

const CHANNEL = "watchparty:realtime";
const localHandlers = new Set<Handler>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener("message", (message: MessageEvent<Record<string, unknown>>) => {
      if (!message.data) return;
      for (const handler of localHandlers) handler(message.data);
    });
  }
  return channel;
}

export function emitMockEvent(event: Record<string, unknown>): void {
  for (const handler of localHandlers) handler(event);
  getChannel()?.postMessage(event);
}

export function subscribeMockEvents(handler: Handler): () => void {
  getChannel();
  localHandlers.add(handler);
  return () => {
    localHandlers.delete(handler);
  };
}
