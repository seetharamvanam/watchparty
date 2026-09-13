import { validateMediaUrl } from "@/lib/media";
import { expectedPositionMs } from "@/lib/sync-rules";

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

export function youtubeIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const segments = url.pathname.split("/").filter(Boolean);
    if (host === "youtu.be") {
      const id = segments[0] ?? "";
      return YOUTUBE_ID.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID.test(v)) return v;
      if (segments[0] === "embed" && segments[1] && YOUTUBE_ID.test(segments[1])) {
        return segments[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isHlsUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return /\.m3u8$/i.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

/** Same allowlist as the Backend (`src/lib/media.ts` / API.md). */
export function parseAllowedMedia(raw: string) {
  return validateMediaUrl(raw);
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function estimatedPosition(playback: {
  positionMs: number;
  status: string;
  playbackRate: number;
  updatedAt: string;
  serverNow?: string;
  estimatedPositionMs?: number;
}): number {
  return expectedPositionMs(playback);
}
