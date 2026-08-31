// Minimal ambient types for the WebMCP draft spec
// (https://webmachinelearning.github.io/webmcp/), not yet in lib.dom.d.ts.
// document.modelContext.registerTool() lets a page expose callable tools to
// an in-browser AI agent. Support is experimental (Chrome origin trial,
// chrome://flags/#enable-webmcp-testing) — always feature-detect before use.
interface ModelContextToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

interface ModelContextTool {
  name: string;
  description: string;
  title?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: ModelContextToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ) => Promise<unknown>;
}

interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ): Promise<void>;
}

interface Document {
  readonly modelContext?: ModelContext;
}
