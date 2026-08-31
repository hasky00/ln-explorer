import { NextRequest, NextResponse } from "next/server";
import { fetchNostrProfile, type NostrProfile } from "@/lib/nostr";
import { resolveLightningAddress, extractNodePubkey } from "@/lib/lnurl";
import { getNode, type NodeDetail } from "@/lib/amboss";

export type MatchResult =
  | { status: "no_profile" }
  | { status: "no_lightning_address"; profile: NostrProfile }
  | {
      status: "unresolvable_address";
      profile: NostrProfile;
      lightningAddress: string;
    }
  | {
      status: "matched";
      profile: NostrProfile;
      lightningAddress: string;
      node: NodeDetail;
    };

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!identifier) {
    return NextResponse.json(
      { error: "Provide an npub or NIP-05 identifier." },
      { status: 400 }
    );
  }

  let result: MatchResult;
  try {
    const profile = await fetchNostrProfile(identifier);
    if (!profile) {
      result = { status: "no_profile" };
    } else {
      const lightningAddress = profile.lud16;
      if (!lightningAddress) {
        result = { status: "no_lightning_address", profile };
      } else {
        const lnurl = await resolveLightningAddress(lightningAddress);
        const nodePubkey = lnurl ? extractNodePubkey(lnurl) : null;
        const node = nodePubkey ? await getNode(nodePubkey) : null;

        result = node
          ? { status: "matched", profile, lightningAddress, node }
          : { status: "unresolvable_address", profile, lightningAddress };
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Matching failed. Try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
