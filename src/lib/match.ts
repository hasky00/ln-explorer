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

// Nostr profile -> lightning address (lud16) -> LNURL-pay -> node pubkey ->
// Amboss node. Shared by the /api/match route and the MCP server.
export async function matchNostrToNode(
  identifier: string
): Promise<MatchResult> {
  const profile = await fetchNostrProfile(identifier);
  if (!profile) return { status: "no_profile" };

  const lightningAddress = profile.lud16;
  if (!lightningAddress) return { status: "no_lightning_address", profile };

  const lnurl = await resolveLightningAddress(lightningAddress);
  const nodePubkey = lnurl ? extractNodePubkey(lnurl) : null;
  const node = nodePubkey ? await getNode(nodePubkey) : null;

  return node
    ? { status: "matched", profile, lightningAddress, node }
    : { status: "unresolvable_address", profile, lightningAddress };
}
