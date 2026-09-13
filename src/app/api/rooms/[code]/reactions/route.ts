import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { postReaction } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await readJson(req);
    const result = await postReaction(req, code, body);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
