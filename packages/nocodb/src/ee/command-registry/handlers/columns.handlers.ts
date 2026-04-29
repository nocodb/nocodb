import { registerForward } from '~/command-registry/_replay-context';
import {
  ColumnAddContract,
  ColumnUpdateContract,
  ColumnDeleteContract,
} from '../operations/columns.operations';
import type { ColumnsService } from 'src/ee/services/columns.service';

export function registerColumnHandlers(svc: ColumnsService): void {
  registerForward(ColumnAddContract, (ctx, p) => svc.columnAdd(ctx, p));
  registerForward(ColumnUpdateContract, (ctx, p) => svc.columnUpdate(ctx, p));
  registerForward(ColumnDeleteContract, (ctx, p) => svc.columnDelete(ctx, p));
}
