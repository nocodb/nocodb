import {
  RowColorConditionAddContract,
  RowColorConditionDeleteContract,
  RowColorConditionUpdateContract,
  RowColoringRemoveContract,
  RowColoringRestoreContract,
  RowColorSelectSetContract,
} from '../operations/row-color.operations';
import type { ViewRowColorService } from '~/services/view-row-color.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerRowColorHandlers(svc: ViewRowColorService): void {
  registerForward(RowColorConditionAddContract, (ctx, p) =>
    svc.addRowColoringCondition(
      ctx,
      p as Parameters<typeof svc.addRowColoringCondition>[1],
    ),
  );
  registerForward(RowColorConditionUpdateContract, (ctx, p) =>
    svc.updateRowColoringCondition(ctx, p),
  );
  registerForward(RowColorConditionDeleteContract, (ctx, p) =>
    svc.deleteRowColoringCondition(ctx, p),
  );
  registerForward(RowColorSelectSetContract, (ctx, p) =>
    svc.setRowColoringSelect(ctx, p),
  );
  registerForward(RowColoringRemoveContract, (ctx, p) =>
    svc.removeRowColorInfo(ctx, p),
  );
  registerForward(RowColoringRestoreContract, (ctx, p) =>
    svc.restoreRowColoring(ctx, p),
  );
}
