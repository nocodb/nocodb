import { z } from 'zod';

export function isZodSchema(value: unknown): value is z.ZodType {
  return typeof (value as any)?.safeParseAsync === 'function';
}

/**
 * Build a tool's `inputSchema` so unknown keys are rejected rather than
 * stripped.
 *
 * Every rendered inputSchema already advertises `additionalProperties: false`
 * — that is what the SDK's renderer emits for a plain `z.object(shape)` — but
 * a plain object's parser *strips* unknown keys instead of failing. A
 * misspelled parameter therefore reported success while silently no-opping
 * whatever it governed (`content` instead of `contentMarkdown` created an
 * empty document). `z.strictObject` makes the validator match the advertisement.
 *
 * Accepts either form `registerTool` takes — a raw shape or an already-built
 * object schema — and is idempotent, so normalizing twice is harmless.
 *
 * An empty shape is returned untouched. The SDK's `normalizeObjectSchema`
 * bails on a zero-key shape, so a no-arg tool skips input validation
 * entirely; tightening it would start rejecting the filler clients send for
 * zero-parameter tools (Cursor sends `{"random_string":"dummy"}`), and there
 * is no misspelled parameter to catch where no parameter exists.
 */
export function toStrictInputSchema(
  inputSchema: Record<string, z.ZodType> | z.ZodType | undefined,
): Record<string, z.ZodType> | z.ZodType | undefined {
  if (!inputSchema) return undefined;

  if (isZodSchema(inputSchema)) {
    // Non-object schemas have nothing to tighten.
    return inputSchema instanceof z.ZodObject
      ? z.strictObject(inputSchema.shape)
      : inputSchema;
  }

  const shape = inputSchema as Record<string, z.ZodType>;

  if (!Object.keys(shape).length) return shape;

  return z.strictObject(shape);
}

/**
 * Wrap a real `McpServer` so tools registered straight onto it get the same
 * treatment as tools routed through the EE registry. Only the CE-standalone
 * path needs this — EE normalizes inside `McpToolRegistry`.
 */
export function strictRegistrar<
  T extends {
    registerTool: (name: string, config: any, handler: any) => unknown;
  },
>(server: T): T {
  return {
    registerTool: (name: string, config: any, handler: any) =>
      server.registerTool(
        name,
        { ...config, inputSchema: toStrictInputSchema(config?.inputSchema) },
        handler,
      ),
  } as unknown as T;
}
