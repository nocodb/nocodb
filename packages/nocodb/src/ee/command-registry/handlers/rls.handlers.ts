import {
  RlsPolicyCreateContract,
  RlsPolicyDeleteContract,
  RlsPolicyFilterCreateContract,
  RlsPolicySetSubjectsContract,
  RlsPolicyUpdateContract,
} from '../operations/rls.operations';
import type { FiltersService } from '~/services/filters.service';
import type { RlsService } from '~/services/rls.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerRlsHandlers(
  rls: RlsService,
  filtersSvc: FiltersService,
): void {
  registerForward(RlsPolicyCreateContract, (ctx, p) =>
    rls.createPolicy(ctx, p),
  );
  registerForward(RlsPolicyUpdateContract, (ctx, p) =>
    rls.updatePolicy(ctx, p),
  );
  registerForward(RlsPolicyDeleteContract, (ctx, p) =>
    rls.deletePolicy(ctx, p),
  );
  registerForward(RlsPolicySetSubjectsContract, (ctx, p) =>
    rls.setSubjects(ctx, p),
  );
  registerForward(RlsPolicyFilterCreateContract, (ctx, p) =>
    filtersSvc.rlsPolicyFilterCreate(ctx, p),
  );
}
