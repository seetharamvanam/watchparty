import { describe, expect, it } from "vitest";
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
});
