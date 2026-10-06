import { NextRequest, NextResponse } from "next/server";
import { searchNostr } from "@/lib/nostr-search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Provide a search query." }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }

  try {
    const result = await searchNostr(q);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch {
    return NextResponse.json(
      { error: "Nostr search failed. Try again in a moment." },
      { status: 502 }
    );
  }
}
