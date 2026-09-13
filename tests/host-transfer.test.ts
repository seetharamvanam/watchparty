import { beforeEach, describe, expect, it } from "vitest";
import { GET as getRoom } from "@/app/api/rooms/[code]/route";
import { POST as setPlayback } from "@/app/api/rooms/[code]/playback/route";
import { POST as leave } from "@/app/api/rooms/[code]/leave/route";
import { POST as presence } from "@/app/api/rooms/[code]/presence/route";
import { getDb } from "@/db";
import { participants } from "@/db/schema";
import { PRESENCE_STALE_MS } from "@/lib/constants";
import { and, eq, isNull } from "drizzle-orm";
import { getPublishedEvents } from "@/lib/ably";
import { createHost, joinGuest, jsonRequest, params, resetTestState } from "./helpers";

describe("host transfer", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("transfers host to the oldest active participant on leave", async () => {
    const { body: created } = await createHost({ displayName: "Host" });
    const code = created.room.code as string;
    const first = await joinGuest(code, "First");
    const second = await joinGuest(code, "Second");
    expect(first.res.status).toBe(200);
    expect(second.res.status).toBe(200);

    const left = await leave(
      jsonRequest(`http://localhost/api/rooms/${code}/leave`, "POST", {}, created.sessionToken),
      params(code),
    );
    expect(left.status).toBe(200);
    const leftBody = await left.json();
    expect(leftBody.hostTransferred).toBe(true);
    expect(leftBody.newHost.id).toBe(first.body.participant.id);
    expect(leftBody.newHost.displayName).toBe("First");

    const events = getPublishedEvents();
    expect(events.some((event) => event.name === "participant_left")).toBe(true);
    expect(events.some((event) => event.name === "host_changed")).toBe(true);

    const view = await getRoom(
      jsonRequest(`http://localhost/api/rooms/${code}`, "GET", undefined, first.body.sessionToken),
      params(code),
    );
    const viewBody = await view.json();
    const host = viewBody.participants.find((p: { isHost: boolean }) => p.isHost);
    expect(host.id).toBe(first.body.participant.id);

    const asNewHost = await setPlayback(
      jsonRequest(`http://localhost/api/rooms/${code}/playback`, "POST", { action: "play" }, first.body.sessionToken),
      params(code),
    );
    expect(asNewHost.status).toBe(200);

    const asOldHost = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause" },
        created.sessionToken,
      ),
      params(code),
    );
    expect(asOldHost.status).toBe(401);

    const asSecond = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause" },
        second.body.sessionToken,
      ),
      params(code),
    );
    expect(asSecond.status).toBe(403);
  });

  it("never leaves two active hosts after transfer, even if leave races playback", async () => {
    const { body: created } = await createHost({
      displayName: "Host",
      mediaUrl: "https://cdn.example.com/movie.mp4",
    });
    const code = created.room.code as string;
    const first = await joinGuest(code, "First");
    const second = await joinGuest(code, "Second");

    const raced = await Promise.all([
      leave(
        jsonRequest(`http://localhost/api/rooms/${code}/leave`, "POST", {}, created.sessionToken),
        params(code),
      ),
      setPlayback(
        jsonRequest(
          `http://localhost/api/rooms/${code}/playback`,
          "POST",
          { action: "seek", positionMs: 9_000 },
          created.sessionToken,
        ),
        params(code),
      ),
    ]);

    const leaveRes = raced[0];
    const playRes = raced[1];
    expect(leaveRes.status).toBe(200);
    expect([200, 401, 403]).toContain(playRes.status);
    if (playRes.status !== 200) {
      const playBody = await playRes.json();
      expect(["UNAUTHORIZED", "FORBIDDEN"]).toContain(playBody.error.code);
    }

    const active = await getDb()
      .select()
      .from(participants)
      .where(and(eq(participants.roomId, created.room.id), isNull(participants.leftAt)));
    expect(active.filter((row) => row.isHost)).toHaveLength(1);
    expect(active.find((row) => row.isHost)?.id).toBe(first.body.participant.id);

    const events = getPublishedEvents();
    expect(events.some((event) => event.name === "host_changed")).toBe(true);
    expect(events.some((event) => event.name === "state_snapshot")).toBe(true);

    const asOld = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause" },
        created.sessionToken,
      ),
      params(code),
    );
    expect(asOld.status).toBe(401);

    const asNew = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause", positionMs: 1_000 },
        first.body.sessionToken,
      ),
      params(code),
    );
    expect(asNew.status).toBe(200);

    const asGuest = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "seek", positionMs: 50 },
        second.body.sessionToken,
      ),
      params(code),
    );
    expect(asGuest.status).toBe(403);
  });

  it("transfers host when the current host goes silent (soft disconnect)", async () => {
    const { body: created } = await createHost({ displayName: "Host" });
    const code = created.room.code as string;
    const first = await joinGuest(code, "First");
    await joinGuest(code, "Second");

    await getDb()
      .update(participants)
      .set({ lastSeenAt: new Date(Date.now() - PRESENCE_STALE_MS - 1_000) })
      .where(eq(participants.id, created.participant.id));

    const beat = await presence(
      jsonRequest(`http://localhost/api/rooms/${code}/presence`, "POST", {}, first.body.sessionToken),
      params(code),
    );
    expect(beat.status).toBe(200);
    const beatBody = await beat.json();
    expect(beatBody.participant.isHost).toBe(true);

    const events = getPublishedEvents();
    expect(events.some((event) => event.name === "host_changed")).toBe(true);
    expect(events.some((event) => event.name === "participant_left")).toBe(true);

    const asOld = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "pause" },
        created.sessionToken,
      ),
      params(code),
    );
    expect(asOld.status).toBe(401);

    const asNew = await setPlayback(
      jsonRequest(
        `http://localhost/api/rooms/${code}/playback`,
        "POST",
        { action: "play" },
        first.body.sessionToken,
      ),
      params(code),
    );
    expect(asNew.status).toBe(200);
  });

  it("lets a late joiner take a seat after a silent host is reaped", async () => {
    const { body: created } = await createHost({ displayName: "Host" });
    const code = created.room.code as string;
    for (let i = 0; i < 7; i += 1) {
      const guest = await joinGuest(code, `Seat ${i}`);
      expect(guest.res.status).toBe(200);
    }

    await getDb()
      .update(participants)
      .set({ lastSeenAt: new Date(Date.now() - PRESENCE_STALE_MS - 1_000) })
      .where(eq(participants.id, created.participant.id));

    const late = await joinGuest(code, "Late");
    expect(late.res.status).toBe(200);
    expect(late.body.room.participantCount).toBe(8);
    expect(late.body.participants.filter((p: { isHost: boolean }) => p.isHost)).toHaveLength(1);
    expect(late.body.participants.find((p: { isHost: boolean }) => p.isHost)?.id).not.toBe(
      created.participant.id,
    );
  });
});
