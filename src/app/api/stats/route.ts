import { NextResponse } from "next/server";
import { getNetworkStats } from "@/lib/amboss";

export async function GET() {
  try {
    const stats = await getNetworkStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json(
      { error: "Network stats lookup failed. Try again in a moment." },
      { status: 502 }
    );
  }
}
