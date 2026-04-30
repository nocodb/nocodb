import {
  BaseVariableCreateContract,
  BaseVariableDeleteContract,
  BaseVariableUpdateContract,
} from '../operations/base-variables.operations';
import type { BaseVariablesService } from '~/services/base-variables.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerBaseVariableHandlers(svc: BaseVariablesService): void {
  registerForward(BaseVariableCreateContract, (ctx, p) => svc.create(ctx, p));
  registerForward(BaseVariableUpdateContract, (ctx, p) => svc.update(ctx, p));
  registerForward(BaseVariableDeleteContract, (ctx, p) => svc.delete(ctx, p));
}
