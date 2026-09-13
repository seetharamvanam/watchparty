import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, validationError } from "./errors";

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(errorBody(err.code, err.message), { status: err.status });
  }

  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Request validation failed";
    return NextResponse.json(errorBody("VALIDATION_ERROR", message), { status: 400 });
  }

  console.error(err);
  return NextResponse.json(errorBody("VALIDATION_ERROR", "Unexpected server error"), { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw validationError("Request body must be valid JSON");
  }
}
