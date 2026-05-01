import type { NcContext, NcRequest } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';

/**
 * Build a synthetic request object for replay-time service calls. The original
 * request from the sandbox-side mutation is reused (so audit/webhook context
 * stays meaningful) — replay-time tracing is naturally a no-op because
 * `recordCommand` early-exits when the target base isn't a sandbox.
 */
export function makeReplayReq(
  originalReq: NcRequest,
  createdBy: string,
): NcRequest {
  const req = {
    ...originalReq,
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
