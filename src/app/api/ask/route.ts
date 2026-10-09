import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { planCall, type PlannedCall } from "@/lib/ask-router";

// Backend for the simulated Alexa+ page (/ask). It acts exactly like Alexa+
// would: an MCP client that connects to E-light's remote MCP server over
// Streamable HTTP and calls a tool. Nothing here touches Amboss directly.

interface ToolStep {
  tool: string;
  args: Record<string, string>;
  spoken: string;
  isError: boolean;
}

function firstText(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content;
  return content?.find((c) => c.type === "text")?.text ?? "";
}

export async function POST(request: Request) {
  let question = "";
  try {
    question = String((await request.json())?.question ?? "").slice(0, 300);
  } catch {
    // fall through to the empty-question answer
  }

  const plan = planCall(question);
  if (!plan) {
    return Response.json({
      spoken:
        "You can ask me about a Lightning node, the size of the network, or a Nostr address.",
      steps: [],
    });
  }

  const mcpUrl = new URL("/api/mcp", request.url);
  const client = new Client({ name: "e-light-voice", version: "0.2.0" });
  const steps: ToolStep[] = [];

  const call = async ({ tool, args }: PlannedCall) => {
    const result = await client.callTool({ name: tool, arguments: args });
    const step: ToolStep = {
      tool,
      args,
      spoken: firstText(result),
      isError: Boolean(result.isError),
    };
    steps.push(step);
    return { step, result };
  };

  try {
    await client.connect(new StreamableHTTPClientTransport(mcpUrl));

    const { step, result } = await call(plan);

    // "Tell me about ACINQ": a name search only gives the headline, so follow up
    // with the top match's full details the way an assistant would.
    if (plan.tool === "search_nodes" && !step.isError) {
      const top = (result.structuredContent as { results?: { pubkey: string }[] })
        ?.results?.[0];
      if (top) await call({ tool: "get_node_details", args: { pubkey: top.pubkey } });
    }

    const last = steps[steps.length - 1];
    return Response.json({ spoken: last.spoken, steps });
  } catch {
    return Response.json(
      { spoken: "Sorry, I couldn't reach the Lightning data just now.", steps },
      { status: 502 }
    );
  } finally {
    void client.close();
  }
}
