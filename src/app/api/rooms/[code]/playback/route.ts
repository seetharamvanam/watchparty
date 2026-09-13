import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { controlPlayback, getPlayback } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const result = await getPlayback(code);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await readJson(req);
    const result = await controlPlayback(req, code, body);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
