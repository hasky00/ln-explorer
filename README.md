# E-light (LN Explorer)

Ask the Bitcoin Lightning Network a question out loud and get a spoken answer.

E-light is a Lightning Network explorer with a **remote MCP server** (Streamable HTTP,
MCP spec 2025-11-25) that voice assistants like **Alexa+** can connect to, plus a
simulated Alexa+ voice experience you can try in the browser.

**Live:** https://ln-explorer-hasky.netlify.app
**Try the voice experience:** https://ln-explorer-hasky.netlify.app/ask
**MCP endpoint:** `https://ln-explorer-hasky.netlify.app/api/mcp`

## Why voice + Lightning

The Lightning Network is public, but its data lives in block-explorer tables built for
experts. People actually ask simple questions: *"How big is Lightning right now?"*,
*"Is ACINQ's node reliable?"*, *"Which node receives payments for this Nostr account?"*

E-light answers those in one spoken sentence. Every tool returns a voice-ready answer
(rounded numbers, no emoji, no hex strings) for the assistant to read aloud, plus the full
structured data for agents that want to reason further.

## MCP server (Alexa+ track)

[`src/app/api/mcp/route.ts`](src/app/api/mcp/route.ts) serves the MCP server built in
[`src/lib/mcp-server.ts`](src/lib/mcp-server.ts) with the official
`@modelcontextprotocol/sdk`. It is stateless (a fresh server per request), which suits
serverless hosting, and every tool is read-only.

| Tool | Input | Spoken answer example |
| --- | --- | --- |
| `search_nodes` | `query` — node name or pubkey | "The best match is ACINQ, with 360 bitcoin of capacity across 1,929 channels." |
| `get_node_details` | `pubkey` — 66-char hex | "ACINQ has 364 bitcoin of capacity across 1,931 channels. It ranks number 2 by capacity." |
| `get_network_stats` | — | "The Lightning Network has 13,610 active nodes and 34,841 channels, holding 3,666 bitcoin in total." |
| `find_node_for_nostr_profile` | `identifier` — npub or NIP-05 | "hasky uses the lightning address hasky@primal.net, but it doesn't reveal which node receives the payments." |

`find_node_for_nostr_profile` is the unusual one: it follows a Nostr identity to its
lightning address (`lud16`), resolves the LNURL-pay endpoint, extracts the receiving node
and looks it up, connecting a social identity to its payment infrastructure.

### Connect an MCP client

Any MCP client that supports Streamable HTTP can connect, for example Claude Code:

```bash
claude mcp add --transport http e-light https://ln-explorer-hasky.netlify.app/api/mcp
```

Or call it directly:

```bash
curl -s https://ln-explorer-hasky.netlify.app/api/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_network_stats","arguments":{}}}'
```

## Ask E-light: simulated Alexa+ experience

[`/ask`](https://ln-explorer-hasky.netlify.app/ask) behaves like an Alexa+ conversation:

1. Tap the E and speak (Web Speech API), or type, or tap an example.
2. [`/api/ask`](src/app/api/ask/route.ts) acts as an **MCP client** of E-light's own
   `/api/mcp` server over Streamable HTTP, exactly the way Alexa+ connects.
   [`ask-router.ts`](src/lib/ask-router.ts) picks the tool, and a name search is
   followed by a details lookup, like an assistant chaining tools.
3. The answer is read aloud with the most natural voice the device offers. The
   "MCP calls" panel shows which tools ran.

Works in Chrome and Safari (desktop and iPhone). On iPhone, downloading the free
"Ava (Premium)" voice in Settings → Accessibility → Spoken Content makes it sound best.

## Built during the Amazon Developer Hackathon

E-light existed before as a web explorer with in-browser WebMCP tools. During the
hackathon window I added:

- The remote MCP server (`/api/mcp`) with four voice-first tools
- The Nostr → Lightning node tool, with matching logic shared with the website
  ([`src/lib/match.ts`](src/lib/match.ts))
- The Ask E-light voice experience (`/ask`, `/api/ask`)
- iPhone speech fixes and natural-voice selection

## WebMCP tools (in-browser agents)

Block explorers are built for humans: you search, you read a table, you click through to a
node page. An agent asked "which Lightning nodes does ACINQ run, and how much capacity do
they have?" has to load that UI and scrape it — brittle, and it breaks the moment the
markup changes.

LN Explorer registers its three lookups as real tools via `document.modelContext`. An agent
in a WebMCP-capable browser discovers them on page load and calls them with structured
arguments, getting back structured JSON. Same data the UI renders, no scraping.

## WebMCP tools

Registered in [`src/components/WebMcpTools.tsx`](src/components/WebMcpTools.tsx), mounted
once from the root layout. All three are read-only (`readOnlyHint: true`).

| Tool | Input | Returns |
| --- | --- | --- |
| `searchNode` | `query` — alias (partial ok) or full pubkey | Matching nodes with alias, pubkey, capacity, channel count |
| `getNodeDetail` | `pubkey` — full node public key | Alias, capacity, channels, ranks, uptime, linked Nostr / lightning-address socials |
| `getNetworkStats` | — | Total and active node counts, channel count, total capacity in sats |

Each backs onto a route under `src/app/api/`, so the same data is reachable over plain HTTP
(`/api/search?q=acinq`, `/api/node/<pubkey>`, `/api/stats`).

## Trying the tools

WebMCP is experimental. You need either ChatGPT's in-app browser or Chrome with WebMCP
enabled at `chrome://flags/#enable-webmcp-testing`. Then open the live site (or a local
dev server) and ask the agent something like *"use the page's tools to look up ACINQ's
Lightning node and tell me its capacity."*

Registration is feature-detected — in a browser without `document.modelContext` the
component is a no-op and the site works as an ordinary explorer.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

No configuration is required. Data comes from the [Amboss](https://amboss.space) GraphQL
API, whose search, node and network-metrics queries are public.

### Optional: Amboss API key

Set `AMBOSS_API_KEY` to send an authenticated Amboss request. Nothing in this project needs
it — it exists only for account-scoped queries, which none of these routes use. Copy
`.env.example` to `.env.local` if you want to set one.

## Features

- **Node search** — fuzzy alias or exact pubkey lookup
- **Node detail** — capacity, channels, ranks, uptime, and linked socials
- **Network stats** — live totals plus a capacity and node-count trend
- **Nostr × Lightning matcher** — resolves Nostr identities to Lightning nodes

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · deployed on Netlify

## License

MIT — see [LICENSE](LICENSE).
