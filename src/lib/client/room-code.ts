import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/constants";

/** Client copy of the Backend alphabet check — do not import `src/lib/codes.ts` (node:crypto). */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isRoomCodeFormat(code: string): boolean {
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code);
}

export function filterCodeInput(raw: string): string {
  return normalizeRoomCode(raw).replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}
