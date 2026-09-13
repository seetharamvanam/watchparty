import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { createRealtimeToken } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await createRealtimeToken(req, body);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
