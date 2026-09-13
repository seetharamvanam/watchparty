import { beforeEach, describe, expect, it } from "vitest";
import { POST as avToken } from "@/app/api/rooms/[code]/av-token/route";
import { LIVEKIT_ROOM_PREFIX } from "@/lib/constants";
import { createHost, decodeJwt, jsonRequest, params, resetTestState } from "./helpers";

describe("LiveKit AV tokens", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("mints a short-lived token for the participant identity", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const res = await avToken(
      jsonRequest(`http://localhost/api/rooms/${code}/av-token`, "POST", {}, created.sessionToken),
      params(code),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe(process.env.NEXT_PUBLIC_LIVEKIT_URL);
    expect(body.roomName).toBe(`${LIVEKIT_ROOM_PREFIX}${code}`);
    expect(body.identity).toBe(created.participant.id);
    expect(body.token).toEqual(expect.any(String));
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const payload = decodeJwt(body.token);
    expect(payload.sub).toBe(created.participant.id);
    const video = payload.video as Record<string, unknown>;
    expect(video.room).toBe(`${LIVEKIT_ROOM_PREFIX}${code}`);
    expect(video.roomJoin).toBe(true);
    expect(video.canPublish).toBe(true);
    expect(video.canSubscribe).toBe(true);
    expect(video.roomRecord).toBeUndefined();
  });

  it("requires a session token", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const res = await avToken(jsonRequest(`http://localhost/api/rooms/${code}/av-token`, "POST"), params(code));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });
});
