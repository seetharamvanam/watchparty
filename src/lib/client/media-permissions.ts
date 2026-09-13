export type MediaPermissionKind = "cam" | "mic";
export type MediaDenied = { cam?: boolean; mic?: boolean };

export const BROWSER_SETTINGS_HINT =
  "Look for the lock or camera icon in the address bar, allow camera and microphone for this site, then retry.";

export function isPermissionDeniedError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
  }
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name?: string }).name;
    return name === "NotAllowedError" || name === "PermissionDeniedError";
  }
  return false;
}

export function hasDeniedMedia(denied: MediaDenied): boolean {
  return Boolean(denied.cam || denied.mic);
}

export function permissionRecoveryCopy(denied: MediaDenied): {
  title: string;
  body: string;
  retryLabel: string;
  announce: string;
} {
  const cam = Boolean(denied.cam);
  const mic = Boolean(denied.mic);

  if (cam && mic) {
    return {
      title: "Camera and microphone are blocked",
      body: "You can still watch. Allow both in this site’s browser settings, then retry. The room stays ready either way.",
      retryLabel: "Retry camera and mic",
      announce: "Camera and microphone permission denied. You can still watch.",
    };
  }
  if (cam) {
    return {
      title: "Camera is blocked",
      body: "You can still watch — your face stays an avatar. Allow camera in this site’s browser settings, then retry.",
      retryLabel: "Retry camera",
      announce: "Camera permission denied. You can still watch.",
    };
  }
  return {
    title: "Microphone is blocked",
    body: "You can still watch. Allow microphone in this site’s browser settings, then retry.",
    retryLabel: "Retry microphone",
    announce: "Microphone permission denied. You can still watch.",
  };
}

export function permissionKeyFor(name: "camera" | "microphone"): MediaPermissionKind {
  return name === "camera" ? "cam" : "mic";
}

export function shouldClearDenied(state: string): boolean {
  return state === "granted";
}

type PermissionQuery = (descriptor: { name: "camera" | "microphone" }) => Promise<{
  state: string;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}>;

/** Fail-closed: unsupported browsers simply never fire grant recovery. */
export function watchMediaPermissionGrant(
  query: PermissionQuery | undefined,
  onGranted: (kind: MediaPermissionKind) => void,
): () => void {
  if (!query) return () => {};

  let cancelled = false;
  const cleanups: Array<() => void> = [];

  const watch = async (name: "camera" | "microphone") => {
    try {
      const status = await query({ name });
      if (cancelled) return;
      const handle = () => {
        if (shouldClearDenied(status.state)) onGranted(permissionKeyFor(name));
      };
      status.addEventListener("change", handle);
      cleanups.push(() => status.removeEventListener("change", handle));
    } catch {
      // Chrome-only names; Safari / mock fail closed.
    }
  };

  void watch("camera");
  void watch("microphone");

  return () => {
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
  };
}
