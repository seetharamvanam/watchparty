/**
 * Mock is fail-closed.
 * - Production builds never mock (`NODE_ENV === "production"`).
 * - Local/dev requires an explicit `NEXT_PUBLIC_USE_MOCK_API=true`.
 * - A missing API URL never enables mock.
 */
export function isMockApi(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
}

/** Optional override. Empty means same-origin `/api` (this Next app). */
export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export const LEGAL_COPY =
  "Only paste links you’re allowed to watch. We don’t host or copy the movie.";

export const REACTION_EMOJIS = ["🔥", "😂", "😮", "❤️", "👏"] as const;
export const PRESENCE_INTERVAL_MS = 15_000;
