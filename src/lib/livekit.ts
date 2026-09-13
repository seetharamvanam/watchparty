import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_ROOM_PREFIX, LIVEKIT_TOKEN_TTL_SECONDS } from "./constants";

export function livekitRoomName(code: string): string {
  return `${LIVEKIT_ROOM_PREFIX}${code.toUpperCase()}`;
}

export function getLivekitUrl(): string {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not configured");
  }
  return url;
}

export async function mintAvToken(input: {
  identity: string;
  displayName: string;
  code: string;
}): Promise<{ token: string; url: string; roomName: string; identity: string; expiresAt: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be configured");
  }

  const roomName = livekitRoomName(input.code);
  const expiresAt = new Date(Date.now() + LIVEKIT_TOKEN_TTL_SECONDS * 1000);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: input.identity,
    name: input.displayName,
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
  });

  // Camera + microphone only. Recording grants are intentionally omitted.
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  const token = await at.toJwt();

  return {
    token,
    url: getLivekitUrl(),
    roomName,
    identity: input.identity,
    expiresAt: expiresAt.toISOString(),
  };
}
