import Ably from "ably";
import { ABLY_TOKEN_TTL_MS } from "./constants";
import type { AblyEventName } from "./types";

export type PublishedEvent = {
  channel: string;
  name: AblyEventName;
  data: unknown;
};

const published: PublishedEvent[] = [];

export function getPublishedEvents(): PublishedEvent[] {
  return published;
}

export function resetPublishedEvents() {
  published.length = 0;
}

function roomChannel(code: string): string {
  return `room:${code.toUpperCase()}`;
}

function getAblyRest(): Ably.Rest {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error("ABLY_API_KEY is not configured");
  }
  return new Ably.Rest({ key });
}

/** Client tokens are subscribe-only. Server publishes with ABLY_API_KEY. */
export const CLIENT_ABLY_CAPABILITIES = ["subscribe", "presence", "history"] as const;

export async function createAblyTokenRequest(clientId: string, code: string) {
  const rest = getAblyRest();
  const channel = roomChannel(code);
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId,
    ttl: ABLY_TOKEN_TTL_MS,
    capability: {
      [channel]: [...CLIENT_ABLY_CAPABILITIES],
    },
  });

  return {
    tokenRequest,
    channel,
  };
}

export async function publishRoomEvent(code: string, name: AblyEventName, data: unknown) {
  const channel = roomChannel(code);
  published.push({ channel, name, data });

  if (process.env.VITEST === "true") {
    return;
  }

  const key = process.env.ABLY_API_KEY;
  if (!key) {
    console.warn("ABLY_API_KEY is not configured; skipping realtime publish");
    return;
  }

  const rest = getAblyRest();
  await rest.channels.get(channel).publish(name, data);
}

export function ablyPlaybackEvent(
  type: "play" | "pause" | "seek" | "rate" | "change_media",
  playback: {
    status: string;
    positionMs: number;
    playbackRate: number;
    mediaUrl: string | null;
    mediaType: string | null;
    updatedAt: Date;
  },
  actorParticipantId: string,
) {
  return {
    type,
    status: playback.status,
    positionMs: playback.positionMs,
    playbackRate: playback.playbackRate,
    mediaUrl: playback.mediaUrl,
    mediaType: playback.mediaType,
    updatedAt: playback.updatedAt.toISOString(),
    serverNow: new Date().toISOString(),
    driftCorrectionMs: 500,
    actorParticipantId,
  };
}
