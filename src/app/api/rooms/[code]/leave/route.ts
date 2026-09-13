import { NextResponse } from "next/server";
import { handleError } from "@/lib/http";
import { leaveRoom } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const result = await leaveRoom(req, code);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
