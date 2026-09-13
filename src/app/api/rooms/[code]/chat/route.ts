import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { listChat, parseLimit, postChat } from "@/lib/watchparty";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const result = await listChat(req, code, parseLimit(req.url));
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await readJson(req);
    const result = await postChat(req, code, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
