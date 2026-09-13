import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getRoom } from "@/app/api/rooms/[code]/route";
import { GET as getPlayback, POST as setPlayback } from "@/app/api/rooms/[code]/playback/route";
import { getDb } from "@/db";
import { playbackStates, rooms } from "@/db/schema";
import { getPublishedEvents } from "@/lib/ably";
import { SYNC_DRIFT_MS } from "@/lib/constants";
import {
  expectedPositionMs,
  isStalePlaybackClock,
  playbackEventId,
  shouldCorrectDrift,
} from "@/lib/sync-rules";
import { createHost, joinGuest, jsonRequest, params, resetTestState } from "./helpers";

async function playAndAge(code: string, token: string, ageMs: number, positionMs = 1_500) {
  const play = await setPlayback(
    jsonRequest(
      `http://localhost/api/rooms/${code}/playback`,
      "POST",
      { action: "play", positionMs },
      token,
    ),
    params(code),
  );
  expect(play.status).toBe(200);

  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1);
  expect(room).toBeTruthy();
  const aged = new Date(Date.now() - ageMs);
  await db
    .update(playbackStates)
    .set({ updatedAt: aged, positionMs, status: "playing" })
    .where(eq(playbackStates.roomId, room.id));

  return { aged, positionMs };
}

describe("late-join playback snapshot", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("GET room / GET playback / join return estimated position while playing", async () => {
    const { body: created } = await createHost({
      mediaUrl: "https://cdn.example.com/movie.mp4",
    });
    const code = created.room.code as string;
    const token = created.sessionToken as string;

    const ageMs = 5_000;
    const { positionMs } = await playAndAge(code, token, ageMs);

    const getPlay = await getPlayback(
      jsonRequest(`http://localhost/api/rooms/${code}/playback`, "GET"),
      params(code),
    );
    expect(getPlay.status).toBe(200);
    const playBody = await getPlay.json();
    expect(playBody.playback.status).toBe("playing");
    expect(playBody.playback.positionMs).toBe(positionMs);
    expect(playBody.playback.estimatedPositionMs).toBeGreaterThanOrEqual(positionMs + ageMs - 250);
    expect(playBody.playback.estimatedPositionMs).toBeLessThan(positionMs + ageMs + 750);
    expect(playBody.playback.serverNow).toEqual(expect.any(String));
    expect(playBody.playback.eventId).toBe(playbackEventId(playBody.playback.updatedAt));

    const view = await getRoom(jsonRequest(`http://localhost/api/rooms/${code}`, "GET"), params(code));
    const viewBody = await view.json();
    expect(viewBody.playback.estimatedPositionMs).toBeGreaterThanOrEqual(positionMs + ageMs - 250);
    expect(Math.abs(viewBody.playback.estimatedPositionMs - playBody.playback.estimatedPositionMs)).toBeLessThan(1_000);

    const guest = await joinGuest(code, "Late");
    expect(guest.res.status).toBe(200);
    expect(guest.body.playback.status).toBe("playing");
    expect(guest.body.playback.mediaUrl).toContain("movie.mp4");
    expect(guest.body.playback.estimatedPositionMs).toBeGreaterThanOrEqual(positionMs + ageMs - 250);
    expect(guest.body.playback.eventId).toBe(playbackEventId(guest.body.playback.updatedAt));

    const snapshots = getPublishedEvents().filter((event) => event.name === "state_snapshot");
    const joinSnapshot = snapshots.at(-1)?.data as { playback?: { estimatedPositionMs?: number } };
    expect(joinSnapshot.playback?.estimatedPositionMs).toBeGreaterThanOrEqual(positionMs + ageMs - 250);
  });
});

describe("drift and stale event rules", () => {
  it("corrects only when |local - host| exceeds SYNC_DRIFT_MS", () => {
    expect(SYNC_DRIFT_MS).toBe(500);
    expect(shouldCorrectDrift(1000, 1499)).toBe(false);
    expect(shouldCorrectDrift(1000, 1501)).toBe(true);
    expect(shouldCorrectDrift(2000, 1000)).toBe(true);
  });

  it("computes late-join expected position from estimatedPositionMs + serverNow", () => {
    const serverNow = "2026-09-13T12:00:05.000Z";
    const expected = expectedPositionMs(
      {
        status: "playing",
        positionMs: 0,
        playbackRate: 1,
        updatedAt: "2026-09-13T12:00:00.000Z",
        serverNow,
        estimatedPositionMs: 5_000,
      },
      Date.parse("2026-09-13T12:00:06.000Z"),
    );
    expect(expected).toBe(6_000);
  });

  it("ignores older and equal eventId/updatedAt, including spoof events with no clock", () => {
    const current = { eventId: "1000", updatedAt: "2026-09-13T12:00:01.000Z" };
    expect(isStalePlaybackClock({ eventId: "900", updatedAt: "2026-09-13T12:00:00.000Z" }, current)).toBe(true);
    expect(isStalePlaybackClock({ eventId: "1000", updatedAt: current.updatedAt }, current)).toBe(true);
    expect(isStalePlaybackClock({ eventId: "1001", updatedAt: "2026-09-13T12:00:02.000Z" }, current)).toBe(false);
    expect(isStalePlaybackClock({}, current)).toBe(true);
  });
});
