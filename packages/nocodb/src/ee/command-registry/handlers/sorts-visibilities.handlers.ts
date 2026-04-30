import {
  SortCreateContract,
  SortDeleteContract,
  SortUpdateContract,
  ViewColumnUpdateContract,
} from '../operations/sorts-visibilities.operations';
import type { SortsService } from '~/services/sorts.service';
import type { ViewColumnsService } from '~/services/view-columns.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerSortHandlers(svc: SortsService): void {
  registerForward(SortCreateContract, (ctx, p) => svc.sortCreate(ctx, p));
  registerForward(SortUpdateContract, (ctx, p) => svc.sortUpdate(ctx, p));
  registerForward(SortDeleteContract, (ctx, p) => svc.sortDelete(ctx, p));
}

export function registerViewColumnHandlers(svc: ViewColumnsService): void {
  registerForward(ViewColumnUpdateContract, (ctx, p) =>
    svc.columnUpdate(ctx, p),
  );
}
