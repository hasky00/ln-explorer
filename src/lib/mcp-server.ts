import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getNetworkStats, getNode, searchNodes } from "@/lib/amboss";
import { matchNostrToNode } from "@/lib/match";

const SATS_PER_BTC = 100_000_000;

// Voice-first formatting: Alexa+ reads the text block aloud, so numbers are
// rounded and written the way a person would say them.
function spokenBtc(sats: string | number | null): string {
  if (sats === null) return "an unknown amount of";
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toLocaleString("en-US", { maximumFractionDigits: btc < 10 ? 2 : 0 })} bitcoin`;
}

function spokenCount(n: number | null): string {
  return n === null ? "an unknown number of" : n.toLocaleString("en-US");
}

function nodeName(alias: string | null, pubkey: string): string {
  // Many aliases carry emoji ("Kraken 🐙⚡"); a voice would read them aloud.
  const clean = alias
    ?.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || `an unnamed node starting ${pubkey.slice(0, 8)}`;
}

// Every tool returns a one-or-two sentence spoken answer in `content`, and the
// full data in `structuredContent` for agents that want to reason over it.
function answer(spoken: string, data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: spoken }],
    structuredContent: data,
  };
}

function failure(spoken: string): CallToolResult {
  return { content: [{ type: "text", text: spoken }], isError: true };
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function createLnExplorerServer(): McpServer {
  const server = new McpServer(
    { name: "e-light", title: "E-light Lightning Explorer", version: "0.2.0" },
    {
      instructions:
        "E-light answers questions about the Bitcoin Lightning Network: finding nodes, " +
        "node details (capacity, channels, rank, uptime), overall network size, and which " +
        "Lightning node sits behind a Nostr profile. Text results are written to be read " +
        "aloud; structuredContent holds the raw numbers (capacity in sats).",
    }
  );

  server.registerTool(
    "search_nodes",
    {
      title: "Search Lightning nodes",
      description:
        "Find Lightning Network nodes by name (partial match) or by full node pubkey. " +
        "Use this first when the user names a node, e.g. 'ACINQ' or 'Kraken'.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Node name (partial is fine) or full 66-character node pubkey"),
      },
      annotations: readOnly,
    },
    async ({ query }) => {
      try {
        const results = await searchNodes(query);
        if (results.length === 0) {
          return answer(`I couldn't find any Lightning node matching ${query}.`, {
            results: [],
          });
        }
        const top = results[0];
        const more =
          results.length > 1 ? ` I found ${results.length} matches in total.` : "";
        return answer(
          `The best match is ${nodeName(top.alias, top.pubkey)}, with ${spokenBtc(
            top.capacity
          )} of capacity across ${spokenCount(Number(top.channel_amount))} channels.${more}`,
          { results }
        );
      } catch {
        return failure("The Lightning node search is unavailable right now. Try again in a moment.");
      }
    }
  );

  server.registerTool(
    "get_node_details",
    {
      title: "Lightning node details",
      description:
        "Get full details for one Lightning node by its pubkey: capacity, channel count, " +
        "capacity rank, uptime, and linked Nostr or lightning address. Get the pubkey from " +
        "search_nodes if the user only gave a name.",
      inputSchema: {
        pubkey: z
          .string()
          .regex(/^[0-9a-fA-F]{66}$/, "Expected a 66-character hex node pubkey")
          .describe("Full 66-character hex Lightning node pubkey"),
      },
      annotations: readOnly,
    },
    async ({ pubkey }) => {
      try {
        const node = await getNode(pubkey);
        if (!node) return failure("I couldn't find a Lightning node with that key.");

        const name = nodeName(node.alias, node.pubKey);
        const rank = node.capacityRank
          ? ` It ranks number ${spokenCount(node.capacityRank)} by capacity.`
          : "";
        const uptime = node.uptime?.month
          ? ` Its uptime over the last month is ${Math.round(Number(node.uptime.month))} percent.`
          : "";
        return answer(
          `${name} has ${spokenBtc(node.capacity)} of capacity across ${spokenCount(
            node.channels
          )} channels.${rank}${uptime}`,
          { node }
        );
      } catch {
        return failure("Node lookup is unavailable right now. Try again in a moment.");
      }
    }
  );

  server.registerTool(
    "get_network_stats",
    {
      title: "Lightning Network stats",
      description:
        "Get the current size of the whole Lightning Network: active and total nodes, " +
        "channel count, total capacity, and the change over the last 30 days.",
      annotations: readOnly,
    },
    async () => {
      try {
        const stats = await getNetworkStats();
        const first = stats.trend[0];
        const last = stats.trend[stats.trend.length - 1];
        let change = "";
        if (first && last && first.capacity > 0) {
          const pct = ((last.capacity - first.capacity) / first.capacity) * 100;
          const dir = pct >= 0 ? "up" : "down";
          change = ` Capacity is ${dir} ${Math.abs(pct).toFixed(1)} percent over the last 30 days.`;
        }
        return answer(
          `The Lightning Network has ${spokenCount(stats.activeNodes)} active nodes and ${spokenCount(
            stats.totalChannels
          )} channels, holding ${spokenBtc(stats.totalCapacity)} in total.${change}`,
          { ...stats }
        );
      } catch {
        return failure("Network stats are unavailable right now. Try again in a moment.");
      }
    }
  );

  server.registerTool(
    "find_node_for_nostr_profile",
    {
      title: "Find the Lightning node behind a Nostr profile",
      description:
        "Given a Nostr identity (npub, hex pubkey, or NIP-05 address like name@domain.com), " +
        "follow its lightning address to the Lightning node that receives its payments, " +
        "and return that node's details.",
      inputSchema: {
        identifier: z
          .string()
          .min(1)
          .describe("npub, hex Nostr pubkey, or NIP-05 identifier such as erna@getalby.com"),
      },
      annotations: readOnly,
    },
    async ({ identifier }) => {
      try {
        const result = await matchNostrToNode(identifier);
        const who =
          "profile" in result
            ? result.profile.displayName || result.profile.name || identifier
            : identifier;

        switch (result.status) {
          case "no_profile":
            return answer(`I couldn't find a Nostr profile for ${identifier}.`, { ...result });
          case "no_lightning_address":
            return answer(`${who} is on Nostr, but hasn't set a lightning address.`, { ...result });
          case "unresolvable_address":
            return answer(
              `${who} uses the lightning address ${result.lightningAddress}, but it doesn't reveal which node receives the payments. That's common with custodial wallets.`,
              { ...result }
            );
          case "matched":
            return answer(
              `${who}'s payments go to ${nodeName(result.node.alias, result.node.pubKey)}, a node with ${spokenBtc(
                result.node.capacity
              )} of capacity across ${spokenCount(result.node.channels)} channels.`,
              { ...result }
            );
        }
      } catch {
        return failure("Nostr lookup is unavailable right now. Try again in a moment.");
      }
    }
  );

  return server;
}
