import { beforeEach, describe, expect, it } from "vitest";
import { POST as realtimeToken } from "@/app/api/realtime/token/route";
import { createHost, jsonRequest, resetTestState } from "./helpers";

describe("Ably realtime token", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("returns a token request scoped to room:{code}", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const res = await realtimeToken(
      jsonRequest("http://localhost/api/realtime/token", "POST", { code }, created.sessionToken),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel).toBe(`room:${code}`);
    expect(body.tokenRequest.clientId).toBe(created.participant.id);
    expect(JSON.stringify(body.tokenRequest.capability)).toContain(`room:${code}`);
  });

  it("requires a session", async () => {
    const { body: created } = await createHost();
    const res = await realtimeToken(
      jsonRequest("http://localhost/api/realtime/token", "POST", { code: created.room.code }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });
});
