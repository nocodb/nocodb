import type { NcContext, NcRequest } from '~/interface/config';
import type { OperationContract } from '~/command-registry/_types';
import { OperationRegistry } from '~/command-registry/_registry';

/**
 * Build a synthetic request object for replay-time service calls. The original
 * request from the sandbox-side mutation is reused (so audit/webhook context
 * stays meaningful), but `__commandTraced` is unset so nested calls still trace
 * if needed (they shouldn't — replay is the outermost call).
 */
export function makeReplayReq(
  originalReq: NcRequest,
  createdBy: string,
): NcRequest {
  const req = {
    ...originalReq,
    __commandTraced: false,
    user: originalReq?.user ?? { id: createdBy },
    __isReplay: true,
  } as NcRequest;
  return req;
}

/**
 * Boilerplate-free registration for the common handler shape: build a replay
 * `req`, spread it onto `params`, forward to a service method. Handlers that
 * need to thread extra metadata (e.g. `tables.handlers.ts` injecting sandbox
 * column IDs) should call `OperationRegistry.register` directly.
 */
export function registerForward<C extends OperationContract>(
  contract: C,
  forward: (ctx: NcContext, p: any) => Promise<unknown>,
): void {
  OperationRegistry.register(contract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    return forward(ctx, { ...params, req });
  });
}
