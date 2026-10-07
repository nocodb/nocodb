import type { Response } from 'express';

/**
 * The MCP transport is stateless, so there is nothing to push on a GET's SSE
 * stream — yet it stays open, pinning a fully built tool server until the
 * client drops it. The spec lets a server answer GET with 405 instead; DELETE
 * has no session to end.
 *
 * Returns true when the request was refused and the response is written.
 */
export function refuseNonPostMcp(req: { method?: string }, res: Response) {
  if (req.method === 'POST') return false;

  res.setHeader('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
  return true;
}
