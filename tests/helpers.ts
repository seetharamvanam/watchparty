import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { resetPublishedEvents } from "@/lib/ably";
import { POST as createRoomHandler } from "@/app/api/rooms/route";
import { POST as joinRoomHandler } from "@/app/api/rooms/join/route";
import { createTestDb } from "./db";

export function jsonRequest(url: string, method: string, body?: unknown, token?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function params(code: string) {
  return { params: Promise.resolve({ code }) };
}

export async function resetTestState() {
  resetPublishedEvents();
  return createTestDb();
}

export async function expireRoom(code: string) {
  await getDb()
    .update(rooms)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(rooms.code, code.toUpperCase()));
}

export async function createHost(overrides: Record<string, unknown> = {}) {
  const res = await createRoomHandler(
    jsonRequest("http://localhost/api/rooms", "POST", {
      displayName: "Host",
      ...overrides,
    }),
  );
  const body = await res.json();
  return { res, body };
}

export async function joinGuest(code: string, displayName: string) {
  const res = await joinRoomHandler(
    jsonRequest("http://localhost/api/rooms/join", "POST", { code, displayName }),
  );
  const body = await res.json();
  return { res, body };
}

export function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Invalid JWT");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}
