import { registerForward } from '~/command-registry/_replay-context';
import {
  BaseVariableCreateContract,
  BaseVariableUpdateContract,
  BaseVariableDeleteContract,
} from '../operations/base-variables.operations';
import type { BaseVariablesService } from 'src/ee/services/base-variables.service';

export function registerBaseVariableHandlers(svc: BaseVariablesService): void {
  registerForward(BaseVariableCreateContract, (ctx, p) => svc.create(ctx, p));
  registerForward(BaseVariableUpdateContract, (ctx, p) => svc.update(ctx, p));
  registerForward(BaseVariableDeleteContract, (ctx, p) => svc.delete(ctx, p));
}
