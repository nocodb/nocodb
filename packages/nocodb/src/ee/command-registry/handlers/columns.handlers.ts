import {
  ColumnAddContract,
  ColumnDeleteContract,
  ColumnSetAsPrimaryContract,
  ColumnUpdateContract,
} from '../operations/columns.operations';
import type { ColumnReqType } from 'nocodb-sdk';
import type { ColumnsService } from '~/services/columns.service';
import type { LtarSideEffectIds } from '~/services/columns.service.type';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerColumnHandlers(svc: ColumnsService): void {
  // columnAdd threads recorded LTAR side-effect IDs onto `_ltarReplayIds`
  // for `createLTARColumn` to pre-set at each insert site (Model.insert,
  // assoc-table FK cols, back-link cols, reverse LTAR).
  OperationRegistry.register(ColumnAddContract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    const ltarIds = (meta.extra as { ltar?: LtarSideEffectIds } | undefined)
      ?.ltar;
    // Schema validates `column` as `Record<string, unknown>`; the recorded
    // payload was a `ColumnReqType` from the original create call, so the
    // double-step cast is safe.
    return svc.columnAdd(ctx, {
      tableId: params.tableId,
      column: params.column as unknown as ColumnReqType,
      user: req.user,
      _ltarReplayIds: ltarIds,
      req,
    });
  });

  registerForward(ColumnUpdateContract, (ctx, p) => svc.columnUpdate(ctx, p));
  registerForward(ColumnDeleteContract, (ctx, p) => svc.columnDelete(ctx, p));
  registerForward(ColumnSetAsPrimaryContract, (ctx, p) =>
    svc.columnSetAsPrimary(ctx, p),
  );
}
