"use client";

import { useEffect } from "react";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof json?.error === "string" ? json.error : `Request to ${url} failed`
    );
  }
  return json;
}

// Exposes LN Explorer's core lookups as WebMCP tools so an in-browser AI
// agent can call them directly, via document.modelContext.registerTool.
// Spec: https://webmachinelearning.github.io/webmcp/ (experimental — Chrome
// origin trial / chrome://flags/#enable-webmcp-testing). Feature-detected;
// a no-op everywhere else.
export default function WebMcpTools() {
  useEffect(() => {
    if (typeof document === "undefined" || !document.modelContext) return;

    const modelContext = document.modelContext;
    const controller = new AbortController();

    modelContext.registerTool(
      {
        name: "searchNode",
        description:
          "Search Lightning Network nodes by alias (fuzzy match) or pubkey (exact match). Returns a list of matching nodes with alias, pubkey, capacity, and channel count.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Node alias (partial ok) or full node pubkey",
            },
          },
          required: ["query"],
        },
        annotations: { readOnlyHint: true },
        execute: async (input) => {
          const query = String(input.query ?? "");
          const data = (await fetchJson(
            `/api/search?q=${encodeURIComponent(query)}`
          )) as { results: unknown[] };
          return data.results;
        },
      },
      { signal: controller.signal }
    );

    modelContext.registerTool(
      {
        name: "getNodeDetail",
        description:
          "Get full details for a single Lightning Network node by its pubkey: alias, capacity, channel count, ranks, uptime, and any linked Nostr/lightning-address socials.",
        inputSchema: {
          type: "object",
          properties: {
            pubkey: {
              type: "string",
              description: "Full Lightning Network node public key",
            },
          },
          required: ["pubkey"],
        },
        annotations: { readOnlyHint: true },
        execute: async (input) => {
          const pubkey = String(input.pubkey ?? "");
          return fetchJson(`/api/node/${encodeURIComponent(pubkey)}`);
        },
      },
      { signal: controller.signal }
    );

    modelContext.registerTool(
      {
        name: "getNetworkStats",
        description:
          "Get aggregate Lightning Network stats: total and active node counts, total channel count, and total network capacity in sats.",
        annotations: { readOnlyHint: true },
        execute: async () => fetchJson("/api/stats"),
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, []);

  return null;
}
