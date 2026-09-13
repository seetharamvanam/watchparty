import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { createRoom } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await createRoom(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
