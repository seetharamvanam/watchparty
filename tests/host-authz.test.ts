import { beforeEach, describe, expect, it } from "vitest";
import { POST as setMedia } from "@/app/api/rooms/[code]/media/route";
import { POST as setPlayback } from "@/app/api/rooms/[code]/playback/route";
import { createHost, joinGuest, jsonRequest, params, resetTestState } from "./helpers";

describe("host authorization", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("rejects media and playback changes without a session", async () => {
    const { body: created } = await createHost();
    const code = created.room.code;

    const media = await setMedia(
      jsonRequest(`http://localhost/api/rooms/${code}/media`, "POST", {
        mediaUrl: "https://cdn.example.com/movie.mp4",
      }),
      params(code),
    );
    expect(media.status).toBe(401);
    expect((await media.json()).error.code).toBe("UNAUTHORIZED");

    const playback = await setPlayback(
      jsonRequest(`http://localhost/api/rooms/${code}/playback`, "POST", { action: "play" }),
      params(code),
    );
    expect(playback.status).toBe(401);
    expect((await playback.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("forbids guests from changing media or playback", async () => {
    const { body: created } = await createHost();
    const { body: guest } = await joinGuest(created.room.code, "Guest");
    const code = created.room.code;

    const media = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${code}/media`,
        "POST",
        { mediaUrl: "https://cdn.example.com/movie.mp4" },
        guest.sessionToken,
      ),
      params(code),
    );
    expect(media.status).toBe(403);
    expect((await media.json()).error.code).toBe("FORBIDDEN");

    const playback = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause" },
        guest.sessionToken,
      ),
      params(code),
    );
    expect(playback.status).toBe(403);
    expect((await playback.json()).error.code).toBe("FORBIDDEN");
  });

  it("rejects a session from another room", async () => {
    const hostA = await createHost({ displayName: "A" });
    const hostB = await createHost({ displayName: "B" });

    const media = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${hostA.body.room.code}/media`,
        "POST",
        { mediaUrl: "https://cdn.example.com/movie.mp4" },
        hostB.body.sessionToken,
      ),
      params(hostA.body.room.code),
    );
    expect(media.status).toBe(403);
    expect((await media.json()).error.code).toBe("FORBIDDEN");
  });

  it("allows the host to change media and playback", async () => {
    const { body: created } = await createHost();
    const code = created.room.code;
    const token = created.sessionToken as string;

    const media = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${code}/media`,
        "POST",
        { mediaUrl: "https://cdn.example.com/movie.webm" },
        token,
      ),
      params(code),
    );
    expect(media.status).toBe(200);

    const playback = await setPlayback(
      jsonRequest(`http://localhost/api/rooms/${code}/playback`, "POST", { action: "play" }, token),
      params(code),
    );
    expect(playback.status).toBe(200);
  });
});
