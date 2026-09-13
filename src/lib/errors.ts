export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  ROOM_EXPIRED: "ROOM_EXPIRED",
  INVALID_MEDIA_URL: "INVALID_MEDIA_URL",
  YOUTUBE_NOT_EMBEDDABLE: "YOUTUBE_NOT_EMBEDDABLE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function unauthorized(message = "Missing or invalid session token"): AppError {
  return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
}

export function forbidden(message = "You are not allowed to perform this action"): AppError {
  return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
}

export function roomNotFound(message = "Room not found"): AppError {
  return new AppError(ERROR_CODES.ROOM_NOT_FOUND, message, 404);
}

export function roomFull(message = "Room is full (maximum 8 participants)"): AppError {
  return new AppError(ERROR_CODES.ROOM_FULL, message, 409);
}

export function roomExpired(message = "Room has expired"): AppError {
  return new AppError(ERROR_CODES.ROOM_EXPIRED, message, 410);
}

export function invalidMediaUrl(message = "Media URL is not allowed"): AppError {
  return new AppError(ERROR_CODES.INVALID_MEDIA_URL, message, 400);
}

export function youtubeNotEmbeddable(message = "YouTube video is not embeddable"): AppError {
  return new AppError(ERROR_CODES.YOUTUBE_NOT_EMBEDDABLE, message, 400);
}

export function validationError(message = "Request validation failed"): AppError {
  return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 400);
}

export function rateLimited(message = "Too many requests"): AppError {
  return new AppError(ERROR_CODES.RATE_LIMITED, message, 429);
}
