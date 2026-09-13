import { invalidMediaUrl, youtubeNotEmbeddable } from "./errors";

export type MediaType = "youtube" | "direct";

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const DIRECT_EXT = /\.(mp4|webm|m3u8)$/i;

function youtubeHosts(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "www.youtu.be" ||
    host === "music.youtube.com" ||
    host === "www.music.youtube.com"
  );
}

function assertYoutubeId(id: string | undefined): string {
  if (!id || !YOUTUBE_ID.test(id)) {
    throw invalidMediaUrl("YouTube URL must include an 11-character video id");
  }
  return id;
}

/**
 * Validate a host-provided media URL.
 *
 * Clients load media themselves. This function never fetches, proxies, or
 * stores media bytes — it only inspects the URL string.
 */
export function validateMediaUrl(raw: string): { mediaUrl: string; mediaType: MediaType } {
  if (typeof raw !== "string") {
    throw invalidMediaUrl("Media URL is required");
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw invalidMediaUrl("Media URL is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalidMediaUrl("Media URL is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw invalidMediaUrl("Media URL must use HTTPS");
  }

  if (youtubeHosts(url.hostname)) {
    return validateYouTubeUrl(url, trimmed);
  }

  if (!DIRECT_EXT.test(url.pathname)) {
    throw invalidMediaUrl("Direct media must be an HTTPS URL ending in .mp4, .webm, or .m3u8");
  }

  return { mediaUrl: trimmed, mediaType: "direct" };
}

function validateYouTubeUrl(url: URL, original: string): { mediaUrl: string; mediaType: MediaType } {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "music.youtube.com") {
    throw youtubeNotEmbeddable("YouTube Music URLs are not embeddable in Watch Party");
  }

  if (host === "youtu.be") {
    const id = assertYoutubeId(segments[0]);
    if (segments.length > 1) {
      throw invalidMediaUrl("Unsupported youtu.be URL");
    }
    void id;
    return { mediaUrl: original, mediaType: "youtube" };
  }

  const first = segments[0] ?? "";

  if (first === "shorts") {
    throw youtubeNotEmbeddable("YouTube Shorts cannot be embedded");
  }
  if (first === "live") {
    throw youtubeNotEmbeddable("YouTube Live URLs are not embeddable");
  }
  if (first === "clip") {
    throw youtubeNotEmbeddable("YouTube Clips cannot be embedded");
  }

  if (first === "embed") {
    assertYoutubeId(segments[1]);
    return { mediaUrl: original, mediaType: "youtube" };
  }

  if (first === "watch" || url.pathname === "/watch" || url.pathname === "/") {
    const id = url.searchParams.get("v") ?? undefined;
    assertYoutubeId(id);
    return { mediaUrl: original, mediaType: "youtube" };
  }

  throw invalidMediaUrl("YouTube URL must be a watch, youtu.be, or embed link");
}

export function detectMediaType(mediaUrl: string | null | undefined): MediaType | null {
  if (!mediaUrl) {
    return null;
  }
  try {
    return validateMediaUrl(mediaUrl).mediaType;
  } catch {
    return null;
  }
}
