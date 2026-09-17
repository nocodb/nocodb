import { NcApiVersion } from 'nocodb-sdk';
import { mapExceptionToResponse } from '~/filters/global-exception/exception-mapper';

export interface McpErrorResult {
  content: { type: 'text'; text: string }[];
  isError: true;
}

/** One plain `Error: <message>` line, because the consumer is a model. */
export function mcpErrorResult(text: string): McpErrorResult {
  return {
    content: [{ type: 'text', text: `Error: ${text}` }],
    isError: true,
  };
}

/**
 * V3 is the message-rich variant, so a validation failure arrives with its
 * issues folded in; an unexpected DB or driver failure is reduced to the
 * mapped message rather than its internals.
 */
export function mcpErrorMessage(e: unknown): string {
  const mapped = mapExceptionToResponse(e, NcApiVersion.V3);
  const body = mapped.body ?? {};

  return (
    (typeof body.message === 'string' && body.message) ||
    (typeof body.msg === 'string' && body.msg) ||
    'The operation failed'
  );
}

/**
 * A thrown error as an MCP tool result. The message comes from
 * `mapExceptionToResponse`, never a raw `error.message`.
 */
export function serializeMcpError(e: unknown): McpErrorResult {
  return mcpErrorResult(mcpErrorMessage(e));
}
