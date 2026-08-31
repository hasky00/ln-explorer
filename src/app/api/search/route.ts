import { NextRequest, NextResponse } from "next/server";
import { searchNodes } from "@/lib/amboss";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchNodes(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Search failed. Try again in a moment." },
      { status: 502 }
    );
  }
}
