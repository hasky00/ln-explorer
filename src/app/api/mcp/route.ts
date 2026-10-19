import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLnExplorerServer } from "@/lib/mcp-server";

// Remote MCP server over Streamable HTTP (MCP spec 2025-11-25), the transport
// Alexa+ uses for its integrations. Stateless: every POST gets a fresh server
// and transport, which suits serverless hosting (Netlify functions) and is
// safe because every tool is a read-only lookup.

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(request: Request) {
  const server = createLnExplorerServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true, // plain JSON replies, no SSE stream needed
  });

  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch {
    return withCors(
      Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
        { status: 500 }
      )
    );
  } finally {
    // Response is fully built (JSON mode), so it's safe to release resources.
    void transport.close();
    void server.close();
  }
}

// No server-initiated streams or sessions in stateless mode.
function methodNotAllowed() {
  return withCors(
    Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
      { status: 405, headers: { allow: "POST, OPTIONS" } }
    )
  );
}

// A person clicking the endpoint link in a browser gets a short explanation
// page; MCP clients (which never ask for text/html) still get the 405 above.
const HUMAN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E-light MCP server</title>
<style>
body{margin:0;background:#0a0a0a;color:#ededed;font:16px/1.6 system-ui,-apple-system,sans-serif}
main{max-width:640px;margin:0 auto;padding:56px 20px}
h1{color:#fbbf24;font-size:28px;margin:0 0 8px}
code{background:#1c1c1c;padding:2px 6px;border-radius:4px;font-size:14px;word-break:break-all}
a{color:#fbbf24}
li{margin:4px 0}
footer{margin-top:48px;color:#777;font-size:12px}
</style></head><body><main>
<h1>E-light MCP server</h1>
<p>This address is for AI assistants, not browsers. Alexa+, Claude and other MCP clients connect here to ask the Lightning Network questions.</p>
<p><strong>Want to try it yourself?</strong> Open <a href="/ask">Ask E-light</a>, tap the E and ask "How big is the Lightning Network?"</p>
<h2 style="font-size:18px">For developers</h2>
<ul>
<li>Endpoint: <code>https://ln-explorer-hasky.netlify.app/api/mcp</code></li>
<li>Transport: Streamable HTTP, MCP spec 2025-11-25 (POST)</li>
<li>Tools: <code>search_nodes</code>, <code>get_node_details</code>, <code>get_network_stats</code>, <code>find_node_for_nostr_profile</code></li>
<li>Claude Code: <code>claude mcp add --transport http e-light https://ln-explorer-hasky.netlify.app/api/mcp</code></li>
<li>Source: <a href="https://github.com/hasky00/ln-explorer">github.com/hasky00/ln-explorer</a></li>
</ul>
<footer>&copy; ${new Date().getFullYear()} Hasky Labs, Copenhagen. All rights reserved. Made by Hasky Labs.</footer>
</main></body></html>`;

export function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html") && !accept.includes("text/event-stream")) {
    return new Response(HUMAN_PAGE, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return methodNotAllowed();
}

export const DELETE = methodNotAllowed;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
