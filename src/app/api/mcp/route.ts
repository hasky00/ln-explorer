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

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
