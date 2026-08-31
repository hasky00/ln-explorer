// Resolves a lud16 lightning address to its LNURL-pay parameters (LUD-16),
// then attempts to extract a backing LN node pubkey from them. There is no
// standard field for this in LUD-16 — only some self-hosted/LSP-backed
// wallets expose it. Custodial wallets generally don't, so returning null
// here is an expected outcome, not a failure. See PLANS/LN_EXPLORER_V1_PRD.md
// Feature 4.
const NODE_PUBKEY_REGEX = /^[0-9a-f]{66}$/i;
const FETCH_TIMEOUT_MS = 8000;

interface LnurlPayResponse {
  tag?: string;
  callback?: string;
  metadata?: string;
  minSendable?: number;
  maxSendable?: number;
  // Non-standard extension some LNURL servers expose.
  nodePubkey?: string;
}

export async function resolveLightningAddress(
  address: string
): Promise<LnurlPayResponse | null> {
  const [name, domain] = address.split("@");
  if (!name || !domain) return null;

  try {
    const res = await fetch(
      `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) return null;

    const json = await res.json();
    if (json?.tag !== "payRequest") return null;
    return json as LnurlPayResponse;
  } catch {
    return null;
  }
}

export function extractNodePubkey(response: LnurlPayResponse): string | null {
  const candidate = response.nodePubkey;
  if (candidate && NODE_PUBKEY_REGEX.test(candidate)) {
    return candidate.toLowerCase();
  }
  return null;
}
