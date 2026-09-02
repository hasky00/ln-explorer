# LN Explorer

A Lightning Network explorer that exposes its core lookups as **WebMCP tools**, so an
in-browser AI agent can query the Lightning Network directly instead of scraping the page.

**Live:** https://ln-explorer-hasky.netlify.app

## Why WebMCP

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
