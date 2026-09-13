import { beforeEach, describe, expect, it } from "vitest";
import { GET as getRoom } from "@/app/api/rooms/[code]/route";
import { POST as setPlayback } from "@/app/api/rooms/[code]/playback/route";
import { POST as leave } from "@/app/api/rooms/[code]/leave/route";
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
});
