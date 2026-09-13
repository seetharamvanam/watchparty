import { CHAT_BODY_MAX, REACTION_MAX } from "./constants";
import { validationError } from "./errors";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const HTML_TAGS = /<\/?[^>]+>/g;
const ANGLE_BRACKETS = /[<>]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

function graphemeLength(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length;
  }
  return [...value].length;
}

/**
 * Strip HTML, angle brackets, control chars, and bidi/zero-width abuse.
 * Rejects empty or oversized results. Does not interpret markup.
 */
export function sanitizeUserText(raw: string, maxGraphemes: number, field = "text"): string {
  if (typeof raw !== "string") {
    throw validationError(`${field} is required`);
  }

  let value = raw.normalize("NFC");
  value = value.replace(HTML_TAGS, "");
  value = value.replace(ANGLE_BRACKETS, "");
  value = value.replace(CONTROL_CHARS, "");
  value = value.replace(INVISIBLE, "");
  value = value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  value = value.trim();

  if (!value) {
    throw validationError(`${field} is empty after sanitization`);
  }

  if (graphemeLength(value) > maxGraphemes) {
    throw validationError(`${field} is too long`);
  }

  return value;
}

export function sanitizeChatBody(raw: string): string {
  return sanitizeUserText(raw, CHAT_BODY_MAX, "body");
}

export function sanitizeReaction(raw: string): string {
  return sanitizeUserText(raw, REACTION_MAX, "emoji");
}
