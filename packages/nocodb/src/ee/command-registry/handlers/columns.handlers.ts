import {
  ColumnAddContract,
  ColumnDeleteContract,
  ColumnSetAsPrimaryContract,
  ColumnUpdateContract,
} from '../operations/columns.operations';
import type { ColumnsService } from '~/services/columns.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerColumnHandlers(svc: ColumnsService): void {
  registerForward(ColumnAddContract, (ctx, p) => svc.columnAdd(ctx, p));
  registerForward(ColumnUpdateContract, (ctx, p) => svc.columnUpdate(ctx, p));
  registerForward(ColumnDeleteContract, (ctx, p) =>
    svc.columnDelete(ctx, { ...p, skipTrash: true }),
  );
  registerForward(ColumnSetAsPrimaryContract, (ctx, p) =>
    svc.columnSetAsPrimary(ctx, p),
  );
}
