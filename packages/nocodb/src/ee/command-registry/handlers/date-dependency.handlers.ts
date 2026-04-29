import {
  DateDependencyDeleteContract,
  DateDependencyUpdateContract,
} from '../operations/date-dependency.operations';
import type { DateDependencyService } from '~/services/date-dependency.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerDateDependencyHandlers(
  svc: DateDependencyService,
): void {
  registerForward(DateDependencyUpdateContract, (ctx, p) => svc.update(ctx, p));
  registerForward(DateDependencyDeleteContract, (ctx, p) => svc.delete(ctx, p));
}
