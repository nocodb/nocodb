import type {
  RegisteredTool,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  AnySchema,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';

/**
 * The annotation hints a NocoDB MCP tool declares (the spec's
 * `ToolAnnotations`). The SDK types all four as optional; the three a client
 * gates on are required here, so a tool cannot be registered without stating
 * them — the omission OpenAI's publishing scan rejects.
 *
 * - `readOnlyHint` — the tool writes nothing.
 * - `destructiveHint` — the write can overwrite or remove something that
 *   already exists, as opposed to only adding. False on every read-only tool.
 * - `openWorldHint` — the tool reaches beyond the base it is connected to.
 *   True only where a tool executes an automation node, which calls whatever
 *   HTTP endpoint or third-party integration that node is configured with.
 * - `idempotentHint` stays optional: absent reads as false, which is the safe
 *   assumption for a write, and no client requires it.
 */
export interface McpToolAnnotations {
  title?: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint?: boolean;
  openWorldHint: boolean;
}

/**
 * `McpServer['registerTool']` with the annotations made mandatory. Tool
 * families take this in place of the server, so a missing hint is a compile
 * error at the registration site instead of something a scan finds after
 * release. The rest of the signature mirrors the SDK's, so a handler's
 * argument types still come from its `inputSchema`.
 */
export interface McpToolRegistrar {
  registerTool<
    OutputArgs extends ZodRawShapeCompat | AnySchema,
    InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined,
  >(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations: McpToolAnnotations;
      _meta?: Record<string, unknown>;
    },
    cb: ToolCallback<InputArgs>,
  ): RegisteredTool;
}
