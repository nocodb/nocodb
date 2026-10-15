import { NcApiVersion } from 'nocodb-sdk';
import { mapExceptionToResponse } from '~/filters/global-exception/exception-mapper';

// A type alias, not an interface: it must fit the SDK's indexed CallToolResult.
export type McpErrorResult = {
  content: { type: 'text'; text: string }[];
  isError: true;
};

// Kept off the result object so it never goes over the wire.
const errorStatus = new WeakMap<object, number>();

/** The HTTP status a serialized error maps to; unset for hand-built results. */
export function mcpErrorStatus(result: object): number | undefined {
  return errorStatus.get(result);
}

/** One plain `Error: <message>` line, because the consumer is a model. */
export function mcpErrorResult(text: string, status?: number): McpErrorResult {
  const result: McpErrorResult = {
    content: [{ type: 'text', text: `Error: ${text}` }],
    isError: true,
  };
  if (status !== undefined) errorStatus.set(result, status);
  return result;
}

function messageOf(body: Record<string, unknown> | undefined): string {
  return (
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.msg === 'string' && body.msg) ||
    'The operation failed'
  );
}

/** V3 is the message-rich variant — validation issues arrive folded in. */
export function mcpErrorMessage(e: unknown): string {
  return messageOf(mapExceptionToResponse(e, NcApiVersion.V3).body);
}

/** A thrown error as an MCP tool result, never a raw `error.message`. */
export function serializeMcpError(e: unknown): McpErrorResult {
  const mapped = mapExceptionToResponse(e, NcApiVersion.V3);
  return mcpErrorResult(messageOf(mapped.body), mapped.status);
}
