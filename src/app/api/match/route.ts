import { NextRequest, NextResponse } from "next/server";
import { matchNostrToNode, type MatchResult } from "@/lib/match";

export type { MatchResult };

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!identifier) {
    return NextResponse.json(
      { error: "Provide an npub or NIP-05 identifier." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await matchNostrToNode(identifier));
  } catch {
    return NextResponse.json(
      { error: "Matching failed. Try again in a moment." },
      { status: 502 }
    );
  }
}
