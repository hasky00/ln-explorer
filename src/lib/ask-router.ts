// Turns a spoken question into an MCP tool call. A small rule-based router so
// the voice demo needs no LLM account; it can be swapped for a model-driven
// planner (e.g. Amazon Bedrock) without touching the MCP server.

export interface PlannedCall {
  tool:
    | "search_nodes"
    | "get_node_details"
    | "get_network_stats"
    | "find_node_for_nostr_profile";
  args: Record<string, string>;
}

const NODE_PUBKEY = /\b(0[23][0-9a-f]{64})\b/i;
const NPUB = /\b(npub1[02-9ac-hj-np-z]{58})\b/i;

// Speech-to-text writes "erna at getalby dot com"; turn that back into an address.
function normaliseSpokenAddress(text: string): string {
  return text
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s*@\s*/g, "@");
}

const NIP05 = /\b([a-z0-9._-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i;

const NETWORK_WORDS =
  /\b(network|how big|how large|how many nodes|how many channels|total capacity|stats|statistics|growing|shrinking)\b/i;

// Strip the question framing so "tell me about the ACINQ node" -> "ACINQ".
const FILLER =
  /\b(hey|alexa|e-?light|please|can you|could you|tell me about|tell me|look up|lookup|search for|search|find|show me|who is|what is|what's|how much capacity does|how many channels does|info on|details for|about|the|a|lightning|node|nodes|have|has)\b/gi;

export function planCall(question: string): PlannedCall | null {
  const text = question.trim();
  if (!text) return null;

  const pubkey = text.match(NODE_PUBKEY)?.[1];
  if (pubkey) return { tool: "get_node_details", args: { pubkey } };

  const npub = text.match(NPUB)?.[1];
  if (npub) return { tool: "find_node_for_nostr_profile", args: { identifier: npub } };

  const address = normaliseSpokenAddress(text).match(NIP05)?.[1];
  if (address) {
    return {
      tool: "find_node_for_nostr_profile",
      args: { identifier: address.toLowerCase() },
    };
  }

  if (NETWORK_WORDS.test(text)) return { tool: "get_network_stats", args: {} };

  const name = text.replace(FILLER, " ").replace(/[?.!,]/g, " ").replace(/\s+/g, " ").trim();
  if (name) return { tool: "search_nodes", args: { query: name } };

  return null;
}
