import type { NcContext, NcRequest } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';

// `createdBy` is the fallback when originalReq has no user.
export function makeReplayReq(
  originalReq: NcRequest,
  createdBy: string,
): NcRequest {
  return {
    ...originalReq,
    user: originalReq?.user ?? { id: createdBy },
  } as NcRequest;
}

export function registerForward<C extends OperationContract<any>>(
  contract: C,
  forward: (context: NcContext, params: any) => Promise<unknown>,
): void {
  OperationRegistry.register(contract, async (context, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    return forward(context, { ...params, req });
  });
}
