import {
  RlsPolicyCreateContract,
  RlsPolicyDeleteContract,
  RlsPolicyUpdateContract,
} from '../operations/rls.operations';
import type { RlsService } from '~/services/rls.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerRlsHandlers(svc: RlsService): void {
  registerForward(RlsPolicyCreateContract, (ctx, p) =>
    svc.createPolicy(ctx, p),
  );
  registerForward(RlsPolicyUpdateContract, (ctx, p) =>
    svc.updatePolicy(ctx, p),
  );
  registerForward(RlsPolicyDeleteContract, (ctx, p) =>
    svc.deletePolicy(ctx, p),
  );
}
