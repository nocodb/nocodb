import type { NcRequest } from '~/interface/config';

/**
 * Build a synthetic request object for replay-time service calls. The original
 * request from the sandbox-side mutation is reused (so audit/webhook context
 * stays meaningful), but `__commandTraced` is unset so nested calls still trace
 * if needed (they shouldn't — replay is the outermost call).
 */
export function makeReplayReq(originalReq: NcRequest, createdBy: string): NcRequest {
  const req = {
    ...originalReq,
    __commandTraced: false,
    user: originalReq?.user ?? { id: createdBy },
    __isReplay: true,
  } as NcRequest;
  return req;
}
