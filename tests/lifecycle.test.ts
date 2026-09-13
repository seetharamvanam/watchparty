import { beforeEach, describe, expect, it } from "vitest";
import { GET as getRoom } from "@/app/api/rooms/[code]/route";
import { POST as setMedia } from "@/app/api/rooms/[code]/media/route";
import { GET as getPlayback, POST as setPlayback } from "@/app/api/rooms/[code]/playback/route";
import { POST as leave } from "@/app/api/rooms/[code]/leave/route";
import { POST as presence } from "@/app/api/rooms/[code]/presence/route";
import { createHost, expireRoom, joinGuest, jsonRequest, params, resetTestState } from "./helpers";

describe("room lifecycle", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("creates a room with a 6-character code and host session", async () => {
    const { res, body } = await createHost({ title: "Friday movie" });
    expect(res.status).toBe(201);
    expect(body.room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.room.title).toBe("Friday movie");
    expect(body.room.participantCount).toBe(1);
    expect(body.room.maxParticipants).toBe(8);
    expect(body.participant.isHost).toBe(true);
    expect(body.sessionToken).toEqual(expect.any(String));
    expect(body.playback.status).toBe("paused");
    expect(body.playback.mediaType).toBeNull();
  });

  it("joins by code and returns the participant roster", async () => {
    const { body: created } = await createHost();
    const { res, body } = await joinGuest(created.room.code, "Ada");
    expect(res.status).toBe(200);
    expect(body.participant.displayName).toBe("Ada");
    expect(body.participant.isHost).toBe(false);
    expect(body.participants).toHaveLength(2);
    expect(body.playback).toBeTruthy();
  });

  it("returns ROOM_NOT_FOUND for an unknown code", async () => {
    const { res, body } = await joinGuest("ZZZZZZ", "Ada");
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("returns ROOM_FULL when an 9th participant tries to join", async () => {
    const { body: created } = await createHost();
    for (let i = 0; i < 7; i += 1) {
      const joined = await joinGuest(created.room.code, `Guest ${i}`);
      expect(joined.res.status).toBe(200);
    }
    const extra = await joinGuest(created.room.code, "Too Many");
    expect(extra.res.status).toBe(409);
    expect(extra.body.error.code).toBe("ROOM_FULL");
  });

  it("returns ROOM_EXPIRED after the room expiry timestamp", async () => {
    const { body: created } = await createHost();
    await expireRoom(created.room.code);
    const joined = await joinGuest(created.room.code, "Late");
    expect(joined.res.status).toBe(410);
    expect(joined.body.error.code).toBe("ROOM_EXPIRED");
  });

  it("lets the host set media and control playback", async () => {
    const { body: created } = await createHost();
    const code = created.room.code;
    const token = created.sessionToken as string;

    const mediaRes = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${code}/media`,
        "POST",
        { mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        token,
      ),
      params(code),
    );
    expect(mediaRes.status).toBe(200);
    const mediaBody = await mediaRes.json();
    expect(mediaBody.playback.mediaType).toBe("youtube");

    const playRes = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "play", positionMs: 1500 },
        token,
      ),
      params(code),
    );
    expect(playRes.status).toBe(200);
    const playBody = await playRes.json();
    expect(playBody.playback.status).toBe("playing");
    expect(playBody.playback.positionMs).toBe(1500);

    const getRes = await getPlayback(jsonRequest(`http://localhost/api/rooms/${code}/playback`, "GET"), params(code));
    const getBody = await getRes.json();
    expect(getBody.playback.status).toBe("playing");
  });

  it("returns the room view and accepts a presence heartbeat", async () => {
    const { body: created } = await createHost();
    const code = created.room.code;
    const view = await getRoom(
      jsonRequest(`http://localhost/api/rooms/${code}`, "GET", undefined, created.sessionToken),
      params(code),
    );
    const viewBody = await view.json();
    expect(view.status).toBe(200);
    expect(viewBody.room.code).toBe(code);
    expect(viewBody.participant.isHost).toBe(true);

    const beat = await presence(
      jsonRequest(`http://localhost/api/rooms/${code}/presence`, "POST", {}, created.sessionToken),
      params(code),
    );
    expect(beat.status).toBe(200);

    const left = await leave(
      jsonRequest(`http://localhost/api/rooms/${code}/leave`, "POST", {}, created.sessionToken),
      params(code),
    );
    expect(left.status).toBe(200);
  });
});
