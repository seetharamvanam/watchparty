import type { ParticipantPublic } from "@/lib/types";

export interface StoredSession {
  sessionToken: string;
  participant: ParticipantPublic;
  displayName: string;
}

const prefix = "watchparty:session:";

export function sessionKey(code: string): string {
  return `${prefix}${code.toUpperCase()}`;
}

export function readSession(code: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(code));
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function writeSession(code: string, session: StoredSession): void {
  sessionStorage.setItem(sessionKey(code), JSON.stringify(session));
}

export function clearSession(code: string): void {
  sessionStorage.removeItem(sessionKey(code));
}
