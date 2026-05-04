import {
  RowColorConditionAddContract,
  RowColorConditionDeleteContract,
  RowColorConditionUpdateContract,
  RowColoringRemoveContract,
  RowColoringRestoreContract,
  RowColorSelectSetContract,
} from '../operations/row-color.operations';
import type { ViewRowColorService } from '~/services/view-row-color.service';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { OperationRegistry } from '~/command-registry/registry';

export function registerRowColorHandlers(svc: ViewRowColorService): void {
  // Add uses an explicit register so we can fall back to `meta.entityId` for
  // `condition.id`. That way redo of a previously-undone add recreates the
  // condition with its original id, keeping inverse_params (which point at
  // that id) valid across repeated undo/redo cycles.
  OperationRegistry.register(
    RowColorConditionAddContract,
    async (ctx, p, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      // Cast widens the zod-inferred filter (record<string, unknown>) back
      // to the service's `FilterType`. Same shape, narrower nominal type.
      return svc.addRowColoringCondition(ctx, {
        ...p,
        condition: { ...p.condition, id: p.condition?.id ?? meta.entityId },
        req,
      } as Parameters<typeof svc.addRowColoringCondition>[1]);
    },
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
