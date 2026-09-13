import { beforeEach, describe, expect, it } from "vitest";
import { GET as listChat, POST as postChat } from "@/app/api/rooms/[code]/chat/route";
import { CHAT_RATE_LIMIT_MAX } from "@/lib/constants";
import { createHost, jsonRequest, params, resetTestState } from "./helpers";

describe("chat rate limits", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("persists chat messages and rate-limits bursts", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const token = created.sessionToken as string;

    for (let i = 0; i < CHAT_RATE_LIMIT_MAX; i += 1) {
      const res = await postChat(
        jsonRequest(`http://localhost/api/rooms/${code}/chat`, "POST", { body: `hello ${i}` }, token),
        params(code),
      );
      expect(res.status).toBe(201);
    }

    const limited = await postChat(
      jsonRequest(`http://localhost/api/rooms/${code}/chat`, "POST", { body: "too fast" }, token),
      params(code),
    );
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");

    const listed = await listChat(
      jsonRequest(`http://localhost/api/rooms/${code}/chat`, "GET", undefined, token),
      params(code),
    );
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.messages).toHaveLength(CHAT_RATE_LIMIT_MAX);
    expect(body.messages[0].body).toBe("hello 0");
  });
});
