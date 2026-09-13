import { describe, expect, it } from "vitest";
import { createEarlySubscriber, createEventHandoff } from "@/lib/client/realtime-handoff";
import { isStalePlaybackEvent, playbackFromEvent } from "@/lib/client/room-events";
import { loadChatAfterReady, loadRoomReady } from "@/lib/client/room-ready";
import type { PlaybackState, RoomView } from "@/lib/types";

const playback = (updatedAt: string, positionMs = 0): PlaybackState => ({
  status: "playing",
  positionMs,
  playbackRate: 1,
  mediaUrl: "https://cdn.example.com/film.mp4",
  mediaType: "direct",
  updatedAt,
});

const snapshot = (updatedAt: string): RoomView => ({
  room: {
    id: "r1",
    code: "ABC234",
    title: null,
    expiresAt: updatedAt,
    participantCount: 1,
    maxParticipants: 8,
  },
  participant: { id: "p1", displayName: "Ada", isHost: true },
  participants: [{ id: "p1", displayName: "Ada", isHost: true }],
  playback: playback(updatedAt),
});

describe("loadRoomReady", () => {
  it("fetches snapshot and realtime in parallel and does not wait on chat", async () => {
    const order: string[] = [];
    const result = await loadRoomReady({
      getSnapshot: async () => {
        order.push("snapshot-start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push("snapshot-done");
        return snapshot("2026-09-13T12:00:00.000Z");
      },
      connectRealtime: async () => {
        order.push("realtime-start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push("realtime-done");
        return { close() {} };
      },
    });

    expect(order[0]).toBe("snapshot-start");
    expect(order[1]).toBe("realtime-start");
    expect(result.realtimeFailed).toBe(false);
    expect(result.snapshot.playback.mediaType).toBe("direct");
    expect(result.realtime).not.toBeNull();
  });

  it("still returns a snapshot when realtime fails", async () => {
    const result = await loadRoomReady({
      getSnapshot: async () => snapshot("2026-09-13T12:00:00.000Z"),
      connectRealtime: async () => {
        throw new Error("ably down");
      },
    });
    expect(result.realtimeFailed).toBe(true);
    expect(result.realtime).toBeNull();
    expect(result.snapshot.room.code).toBe("ABC234");
  });

  it("closes a successful realtime socket if the snapshot fails", async () => {
    let closed = false;
    await expect(
      loadRoomReady({
        getSnapshot: async () => {
          throw new Error("ROOM_NOT_FOUND");
        },
        connectRealtime: async () => ({
          close() {
            closed = true;
          },
        }),
      }),
    ).rejects.toThrow(/ROOM_NOT_FOUND/);
    expect(closed).toBe(true);
  });
});

describe("loadChatAfterReady", () => {
  it("swallows chat failures so they cannot block ready", async () => {
    const messages = await loadChatAfterReady(async () => {
      throw new Error("RATE_LIMITED");
    });
    expect(messages).toEqual([]);
  });
});

describe("realtime subscribe handoff", () => {
  it("buffers events until release then applies live events in order", () => {
    const applied: string[] = [];
    const handoff = createEventHandoff<string>((event) => applied.push(event));

    handoff.push("joined-during-connect");
    handoff.push("play-during-snapshot");
    expect(handoff.isLive).toBe(false);
    expect(handoff.size).toBe(2);
    expect(applied).toEqual([]);

    handoff.release();
    expect(applied).toEqual(["joined-during-connect", "play-during-snapshot"]);
    expect(handoff.isLive).toBe(true);
    expect(handoff.size).toBe(0);

    handoff.push("leave-after-ready");
    expect(applied).toEqual(["joined-during-connect", "play-during-snapshot", "leave-after-ready"]);
  });

  it("is safe when subscribe connects after the snapshot is already applied", () => {
    const applied: string[] = [];
    const handoff = createEventHandoff<string>((event) => applied.push(event));

    handoff.release();
    expect(applied).toEqual([]);
    handoff.push("late-subscribe-join");
    expect(applied).toEqual(["late-subscribe-join"]);
  });

  it("holds attach-time messages until the first caller subscribe", () => {
    const applied: string[] = [];
    const early = createEarlySubscriber<string>();

    early.dispatch("after-attach");
    early.dispatch("before-caller-subscribe");
    const stop = early.subscribe((event) => applied.push(event));
    expect(applied).toEqual(["after-attach", "before-caller-subscribe"]);

    early.dispatch("live");
    expect(applied).toEqual(["after-attach", "before-caller-subscribe", "live"]);
    stop();
  });
});

describe("playback event freshness", () => {
  it("applies newer play events and ignores stale ones", () => {
    const current = playback("2026-09-13T12:00:05.000Z", 5000);
    const stale = {
      type: "play" as const,
      positionMs: 100,
      updatedAt: "2026-09-13T12:00:01.000Z",
    };
    const fresh = {
      type: "play" as const,
      positionMs: 8000,
      updatedAt: "2026-09-13T12:00:08.000Z",
    };
    expect(isStalePlaybackEvent(stale, current)).toBe(true);
    expect(isStalePlaybackEvent(fresh, current)).toBe(false);
    expect(playbackFromEvent(fresh, current).positionMs).toBe(8000);
  });

  it("treats older or equal eventId and clock-less spoof events as stale", () => {
    const current = { ...playback("2026-09-13T12:00:05.000Z", 5000), eventId: "1773331205000" };
    expect(
      isStalePlaybackEvent(
        {
          type: "state_snapshot",
          eventId: "1773331200000",
          playback: { ...current, eventId: "1773331200000", updatedAt: "2026-09-13T12:00:00.000Z" },
        },
        current,
      ),
    ).toBe(true);
    expect(
      isStalePlaybackEvent(
        { type: "play", eventId: "1773331205000", updatedAt: current.updatedAt, positionMs: 1 },
        current,
      ),
    ).toBe(true);
    expect(
      isStalePlaybackEvent(
        { type: "seek", eventId: "1773331209000", updatedAt: "2026-09-13T12:00:09.000Z", positionMs: 9000 },
        current,
      ),
    ).toBe(false);
    expect(isStalePlaybackEvent({ type: "play", positionMs: 0 }, current)).toBe(true);
  });

  it("does not keep a snapshot estimatedPositionMs on incremental play/seek events", () => {
    const current = {
      ...playback("2026-09-13T12:00:05.000Z", 5000),
      estimatedPositionMs: 5000,
      serverNow: "2026-09-13T12:00:05.000Z",
      eventId: "1",
    };
    const next = playbackFromEvent(
      { type: "seek", positionMs: 9000, updatedAt: "2026-09-13T12:00:09.000Z", eventId: "2" },
      current,
    );
    expect(next.positionMs).toBe(9000);
    expect(next.estimatedPositionMs).toBeUndefined();
    expect(next.eventId).toBe("2");
  });
});
