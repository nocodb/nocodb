import { registerForward } from '~/command-registry/_replay-context';
import {
  RlsPolicyCreateContract,
  RlsPolicyUpdateContract,
  RlsPolicyDeleteContract,
} from '../operations/rls.operations';
import type { RlsService } from 'src/ee/services/rls.service';

export function registerRlsHandlers(svc: RlsService): void {
  registerForward(RlsPolicyCreateContract, (ctx, p) => svc.createPolicy(ctx, p));
  registerForward(RlsPolicyUpdateContract, (ctx, p) => svc.updatePolicy(ctx, p));
  registerForward(RlsPolicyDeleteContract, (ctx, p) => svc.deletePolicy(ctx, p));
}
