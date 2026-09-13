import { beforeEach, describe, expect, it } from "vitest";
import { POST as postChat } from "@/app/api/rooms/[code]/chat/route";
import { POST as postReaction } from "@/app/api/rooms/[code]/reactions/route";
import { sanitizeChatBody, sanitizeReaction } from "@/lib/sanitize";
import { createHost, jsonRequest, params, resetTestState } from "./helpers";

describe("sanitizeUserText", () => {
  it("strips HTML tags and angle brackets", () => {
    expect(sanitizeChatBody("hello <b>world</b>")).toBe("hello world");
    expect(sanitizeChatBody('<script>alert("x")</script>hi')).toBe('alert("x")hi');
  });

  it("rejects script-only / empty-after-sanitize input", () => {
    expect(() => sanitizeChatBody("<script></script>")).toThrow(/empty after sanitization/i);
    expect(() => sanitizeChatBody("<>")).toThrow(/empty after sanitization/i);
    expect(() => sanitizeChatBody("   ")).toThrow(/empty after sanitization/i);
  });

  it("strips control characters and zero-width abuse", () => {
    expect(sanitizeChatBody("hi\u0000there")).toBe("hithere");
    expect(sanitizeChatBody("ok\u200B\u200D")).toBe("ok");
  });

  it("sanitizes reaction strings", () => {
    expect(sanitizeReaction("🔥<script>")).toBe("🔥");
    expect(() => sanitizeReaction("<img onerror=x>")).toThrow(/empty after sanitization/i);
  });
});

describe("chat and reaction HTTP sanitization", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("persists sanitized chat and rejects HTML-only bodies", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const token = created.sessionToken as string;

    const ok = await postChat(
      jsonRequest(
        `http://localhost/api/rooms/${code}/chat`,
        "POST",
        { body: "nice <script>alert(1)</script> scene" },
        token,
      ),
      params(code),
    );
    expect(ok.status).toBe(201);
    expect((await ok.json()).message.body).toBe("nice alert(1) scene");

    const rejected = await postChat(
      jsonRequest(`http://localhost/api/rooms/${code}/chat`, "POST", { body: "<script></script>" }, token),
      params(code),
    );
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("sanitizes reaction emoji and rejects markup-only input", async () => {
    const { body: created } = await createHost();
    const code = created.room.code as string;
    const token = created.sessionToken as string;

    const ok = await postReaction(
      jsonRequest(`http://localhost/api/rooms/${code}/reactions`, "POST", { emoji: "😂<>" }, token),
      params(code),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).reaction.emoji).toBe("😂");

    const rejected = await postReaction(
      jsonRequest(`http://localhost/api/rooms/${code}/reactions`, "POST", { emoji: "<script>" }, token),
      params(code),
    );
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
