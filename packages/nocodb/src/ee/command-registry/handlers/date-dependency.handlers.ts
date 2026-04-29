import { registerForward } from '~/command-registry/_replay-context';
import {
  DateDependencyUpdateContract,
  DateDependencyDeleteContract,
} from '../operations/date-dependency.operations';
import type { DateDependencyService } from 'src/ee/services/date-dependency.service';

export function registerDateDependencyHandlers(svc: DateDependencyService): void {
  registerForward(DateDependencyUpdateContract, (ctx, p) => svc.update(ctx, p));
  registerForward(DateDependencyDeleteContract, (ctx, p) => svc.delete(ctx, p));
}
