import { NextRequest, NextResponse } from "next/server";
import { getNode } from "@/lib/amboss";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/node/[pubkey]">
) {
  const { pubkey } = await ctx.params;

  try {
    const node = await getNode(pubkey);
    if (!node) {
      return NextResponse.json({ error: "Node not found." }, { status: 404 });
    }
    return NextResponse.json(node);
  } catch {
    return NextResponse.json(
      { error: "Node lookup failed. Try again in a moment." },
      { status: 502 }
    );
  }
}
