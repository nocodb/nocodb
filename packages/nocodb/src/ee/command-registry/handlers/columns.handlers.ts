import {
  ColumnAddContract,
  ColumnDeleteContract,
  ColumnSetAsPrimaryContract,
  ColumnUpdateContract,
} from '../operations/columns.operations';
import type { ColumnsService } from '~/services/columns.service';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

interface LtarReplayIds {
  fkColumnId?: string;
  assocModelId?: string;
  assocDefaultViewId?: string;
  reverseColumnId?: string;
  assocChildColId?: string;
  assocParentColId?: string;
  hmBtCallRef?: { childRelColId?: string; savedColumnId?: string };
  hmBtCallTable?: { childRelColId?: string; savedColumnId?: string };
}

export function registerColumnHandlers(svc: ColumnsService): void {
  // columnAdd threads recorded LTAR side-effect IDs onto `_ltarReplayIds`
  // for `createLTARColumn` to pre-set at each insert site (Model.insert,
  // assoc-table FK cols, back-link cols, reverse LTAR).
  OperationRegistry.register(ColumnAddContract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    const ltarIds = (meta.extra as { ltar?: LtarReplayIds } | undefined)?.ltar;
    return svc.columnAdd(ctx, {
      ...params,
      ...(ltarIds ? { _ltarReplayIds: ltarIds } : {}),
      req,
    } as any);
  });

  registerForward(ColumnUpdateContract, (ctx, p) => svc.columnUpdate(ctx, p));
  registerForward(ColumnDeleteContract, (ctx, p) => svc.columnDelete(ctx, p));
  registerForward(ColumnSetAsPrimaryContract, (ctx, p) =>
    svc.columnSetAsPrimary(ctx, p),
  );
}
