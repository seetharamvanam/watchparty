import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BROWSER_SETTINGS_HINT,
  hasDeniedMedia,
  isPermissionDeniedError,
  permissionKeyFor,
  permissionRecoveryCopy,
  shouldClearDenied,
  watchMediaPermissionGrant,
} from "@/lib/client/media-permissions";
import {
  ROOM_PHASE_COPY,
  ROOM_PHASE_STEPS,
  connectionBannerCopy,
  isRoomPhaseCurrent,
  isRoomPhaseReached,
  roomPhaseBarPercent,
  roomPhaseProgress,
} from "@/lib/client/room-phase-copy";
import { speakerIdSet, speakingLabel, tileIsSpeaking } from "@/lib/client/speaking";

describe("ready-state phase copy", () => {
  it("covers the visible boot → syncing → ready machine", () => {
    expect(ROOM_PHASE_STEPS).toEqual(["boot", "syncing", "ready"]);
    expect(roomPhaseProgress("boot")).toBeLessThan(roomPhaseProgress("syncing"));
    expect(roomPhaseProgress("syncing")).toBeLessThan(roomPhaseProgress("ready"));
    expect(roomPhaseBarPercent("boot")).toBeLessThan(roomPhaseBarPercent("syncing"));
    expect(isRoomPhaseCurrent("syncing", "syncing")).toBe(true);
    expect(isRoomPhaseReached("syncing", "boot")).toBe(true);
    expect(isRoomPhaseReached("boot", "ready")).toBe(false);
  });

  it("uses user-facing copy instead of skeleton jargon", () => {
    expect(ROOM_PHASE_COPY.boot.headline).toMatch(/lights/i);
    expect(ROOM_PHASE_COPY.boot.label).not.toMatch(/skeleton/i);
    expect(ROOM_PHASE_COPY.syncing.detail).toMatch(/ready/i);
    expect(ROOM_PHASE_COPY.ready.announce).toMatch(/watch/i);
    expect(ROOM_PHASE_COPY.ready.detail).toMatch(/camera stays off/i);
  });

  it("says the room is usable while live updates connect or drop", () => {
    expect(connectionBannerCopy("connecting")).toMatch(/room is open/i);
    expect(connectionBannerCopy("lost")).toMatch(/still watch/i);
  });
});

describe("permission recovery", () => {
  it("detects browser permission-denied errors", () => {
    expect(isPermissionDeniedError(new DOMException("nope", "NotAllowedError"))).toBe(true);
    expect(isPermissionDeniedError(new DOMException("nope", "PermissionDeniedError"))).toBe(true);
    expect(isPermissionDeniedError(new DOMException("gone", "NotFoundError"))).toBe(false);
    expect(isPermissionDeniedError({ name: "NotAllowedError" })).toBe(true);
    expect(isPermissionDeniedError({ name: "NotReadableError" })).toBe(false);
  });

  it("offers retry + settings hint and never treats cam deny as room-blocking", () => {
    expect(hasDeniedMedia({ cam: true })).toBe(true);
    expect(hasDeniedMedia({})).toBe(false);

    const cam = permissionRecoveryCopy({ cam: true });
    expect(cam.retryLabel).toMatch(/camera/i);
    expect(cam.body).toMatch(/still watch/i);
    expect(cam.body).not.toMatch(/cannot enter|not ready|blocked from the room/i);
    expect(BROWSER_SETTINGS_HINT).toMatch(/address bar/i);

    const both = permissionRecoveryCopy({ cam: true, mic: true });
    expect(both.retryLabel).toMatch(/camera and mic/i);
    expect(both.body).toMatch(/stays ready/i);
  });

  it("clears denied only after a later grant, fail-closed if Permissions API is missing", () => {
    expect(permissionKeyFor("camera")).toBe("cam");
    expect(permissionKeyFor("microphone")).toBe("mic");
    expect(shouldClearDenied("granted")).toBe(true);
    expect(shouldClearDenied("denied")).toBe(false);
    expect(shouldClearDenied("prompt")).toBe(false);

    const granted = vi.fn();
    expect(watchMediaPermissionGrant(undefined, granted)).toBeTypeOf("function");
    watchMediaPermissionGrant(undefined, granted)();
    expect(granted).not.toHaveBeenCalled();
  });

  it("notifies when a watched permission flips to granted", async () => {
    const granted = vi.fn();
    const listeners = new Map<string, () => void>();
    const status = {
      state: "denied",
      addEventListener: (_type: "change", listener: () => void) => {
        listeners.set("change", listener);
      },
      removeEventListener: () => {
        listeners.delete("change");
      },
    };

    const stop = watchMediaPermissionGrant(async ({ name }) => {
      if (name === "microphone") throw new Error("unsupported");
      return status;
    }, granted);

    await Promise.resolve();
    status.state = "granted";
    listeners.get("change")?.();
    expect(granted).toHaveBeenCalledWith("cam");
    stop();
  });
});

describe("frontend ux stays on the backend load path", () => {
  it("does not statically import LiveKit from face-strip or loading UI", () => {
    const src = path.resolve(__dirname, "../src");
    const faceStrip = readFileSync(path.join(src, "components/room/face-strip.tsx"), "utf8");
    const loading = readFileSync(path.join(src, "components/room/room-loading.tsx"), "utf8");
    expect(faceStrip).not.toMatch(/from\s+["']livekit-client["']/);
    expect(faceStrip).toMatch(/import\(["']@\/lib\/client\/livekit["']\)/);
    expect(loading).toMatch(/data-room-phase=\{phase\}/);
    expect(loading).not.toMatch(/Skeleton/);
  });
});

describe("face-strip speaking", () => {
  it("marks local and remote tiles from ActiveSpeakers identities", () => {
    const speakers = speakerIdSet(["host-1", "guest-2"]);
    expect(tileIsSpeaking({ participantId: "host-1", speakerIds: speakers })).toBe(true);
    expect(tileIsSpeaking({ participantId: "guest-2", speakerIds: [] })).toBe(false);
    expect(tileIsSpeaking({ participantId: "guest-2", speakerIds: [], remoteSpeaking: true })).toBe(true);
    expect(tileIsSpeaking({ participantId: "quiet", speakerIds: speakers })).toBe(false);
    expect(speakingLabel("Ada", true)).toBe("Ada is speaking");
    expect(speakingLabel("Ada", false)).toBeUndefined();
  });
});
