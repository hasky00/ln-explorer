import { nip05, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import type { Event } from "nostr-tools/core";

// Nostr relay used to resolve profile metadata for Feature 4 (Nostr x
// Lightning matcher). See PLANS/LN_EXPLORER_V1_PRD.md.
const NOSTR_RELAY_URL = "wss://hasky.chat";
const RELAY_QUERY_TIMEOUT_MS = 8000;

const HEX_PUBKEY_REGEX = /^[0-9a-f]{64}$/i;

export interface NostrProfile {
  pubkey: string;
  name: string | null;
  displayName: string | null;
  picture: string | null;
  nip05: string | null;
  lud16: string | null;
  lud06: string | null;
}

async function resolvePubkey(input: string): Promise<string | null> {
  const trimmed = input.trim();

  if (nip19.NostrTypeGuard.isNPub(trimmed)) {
    const decoded = nip19.decode(trimmed);
    return decoded.type === "npub" ? decoded.data : null;
  }

  if (HEX_PUBKEY_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (nip05.isNip05(trimmed)) {
    const pointer = await nip05.queryProfile(trimmed);
    return pointer?.pubkey ?? null;
  }

  return null;
}

function parseProfileEvent(pubkey: string, event: Event | null): NostrProfile | null {
  if (!event) return null;

  let content: Record<string, unknown>;
  try {
    content = JSON.parse(event.content);
  } catch {
    return null;
  }

  const str = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value : null;

  return {
    pubkey,
    name: str(content.name),
    displayName: str(content.display_name),
    picture: str(content.picture),
    nip05: str(content.nip05),
    lud16: str(content.lud16),
    lud06: str(content.lud06),
  };
}

// Resolves an npub, hex pubkey, or NIP-05 identifier to a Nostr profile
// (kind 0) via NOSTR_RELAY_URL. Returns null if the identifier can't be
// resolved to a pubkey, or no profile event is found for it — both are
// expected, non-error outcomes for the matcher (see PRD Feature 4 states).
export async function fetchNostrProfile(
  identifier: string
): Promise<NostrProfile | null> {
  const pubkey = await resolvePubkey(identifier);
  if (!pubkey) return null;

  const pool = new SimplePool();
  try {
    const event = await pool.get(
      [NOSTR_RELAY_URL],
      { kinds: [0], authors: [pubkey] },
      { maxWait: RELAY_QUERY_TIMEOUT_MS }
    );
    return parseProfileEvent(pubkey, event);
  } finally {
    pool.close([NOSTR_RELAY_URL]);
  }
}
