import {
  FormColumnUpdateContract,
  GridColumnUpdateContract,
  HideAllColumnsContract,
  ShowAllColumnsContract,
  SortCreateContract,
  SortDeleteContract,
  SortUpdateContract,
  ViewColumnsBulkSetVisibilityContract,
  ViewColumnUpdateContract,
} from '../operations/sorts-visibilities.operations';
import type { FormColumnsService } from '~/services/form-columns.service';
import type { GridColumnsService } from '~/services/grid-columns.service';
import type { SortsService } from '~/services/sorts.service';
import type { ViewColumnsService } from '~/services/view-columns.service';
import type { ViewsService } from '~/services/views.service';
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

export function registerGridColumnHandlers(svc: GridColumnsService): void {
  registerForward(GridColumnUpdateContract, (ctx, p) =>
    svc.gridColumnUpdate(ctx, p),
  );
}

export function registerFormColumnHandlers(svc: FormColumnsService): void {
  registerForward(FormColumnUpdateContract, (ctx, p) =>
    svc.columnUpdate(ctx, p),
  );
}

export function registerShowHideAllHandlers(svc: ViewsService): void {
  registerForward(ShowAllColumnsContract, (ctx, p) =>
    svc.showAllColumns(ctx, p),
  );
  registerForward(HideAllColumnsContract, (ctx, p) =>
    svc.hideAllColumns(ctx, p),
  );

  registerForward(ViewColumnsBulkSetVisibilityContract, (ctx, p) =>
    svc.viewColumnsBulkSetVisibility(ctx, p),
  );
}
