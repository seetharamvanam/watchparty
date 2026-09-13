import { beforeEach, describe, expect, it } from "vitest";
import { POST as realtimeToken } from "@/app/api/realtime/token/route";
import { CLIENT_ABLY_CAPABILITIES } from "@/lib/ably";
import { createHost, jsonRequest, resetTestState } from "./helpers";

function parseCapability(raw: unknown): Record<string, string[]> {
  if (typeof raw === "string") {
    return JSON.parse(raw) as Record<string, string[]>;
  }
  if (raw && typeof raw === "object") {
    return raw as Record<string, string[]>;
  }
  throw new Error("Missing Ably capability");
}

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
    const capability = parseCapability(body.tokenRequest.capability);
    const granted = capability[`room:${code}`] ?? [];
    expect(granted.sort()).toEqual([...CLIENT_ABLY_CAPABILITIES].sort());
    expect(granted).not.toContain("publish");
    expect(CLIENT_ABLY_CAPABILITIES).not.toContain("publish");
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
