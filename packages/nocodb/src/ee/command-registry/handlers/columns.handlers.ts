import {
  ColumnAddContract,
  ColumnDeleteContract,
  ColumnSetAsPrimaryContract,
  ColumnUpdateContract,
} from '../operations/columns.operations';
import type { ColumnReqType } from 'nocodb-sdk';
import type { ColumnsService } from '~/services/columns.service';
import type { LtarSideEffectIds } from '~/services/columns.service.type';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import BaseTrash from '~/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerColumnHandlers(
  svc: ColumnsService,
  baseTrashSvc: BaseTrashService,
): void {
  // columnAdd threads recorded LTAR side-effect IDs onto `_ltarReplayIds`
  // for `createLTARColumn` to pre-set at each insert site (Model.insert,
  // assoc-table FK cols, back-link cols, reverse LTAR).
  OperationRegistry.register(ColumnAddContract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    if (ctx.additionalContext?.is_replay && meta.entityId) {
      const trashEntry = await BaseTrash.getByResourceId(
        ctx,
        'field',
        meta.entityId,
      );
      if (trashEntry?.id) {
        await baseTrashSvc.restore(ctx, {
          trashId: trashEntry.id,
          user: req.user,
          req,
        });
        return { id: meta.entityId };
      }
    }

    const ltarIds = (meta.extra as { ltar?: LtarSideEffectIds } | undefined)
      ?.ltar;
    const capturedFilters = (
      meta.extra as { filters?: Array<Record<string, unknown>> } | undefined
    )?.filters;
    // Schema validates `column` as `Record<string, unknown>`; the recorded
    // payload was a `ColumnReqType` from the original create call, so the
    // double-step cast is safe.
    const columnPayload = capturedFilters?.length
      ? {
          ...(params.column as Record<string, unknown>),
          filters: capturedFilters,
        }
      : params.column;
    return svc.columnAdd(ctx, {
      tableId: params.tableId,
      column: columnPayload as unknown as ColumnReqType,
      user: req.user,
      _ltarReplayIds: ltarIds,
      req,
    });
  });

  // On replay:
  //   - threads the originally-captured `ColumnBackupRef` as `_replayBackup`
  //     so the service can restore the pre-conversion cell data into the
  //     destination column after the type change;
  //   - returns the freshly-created backup ref via `metaUpdate`. The service
  //     drops the old backup as part of restore and creates a new sibling
  //     for the OPPOSITE direction. The dispatcher writes that fresh ref
  //     onto the op log row's `meta.backup` so the next undo/redo cycle
  //     can find it — without this swap, the next cycle tries to restore
  //     from the column we just dropped.
  OperationRegistry.register(
    ColumnUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const replayBackup = (
        meta.extra as { backup?: ColumnBackupRef } | undefined
      )?.backup;

      const svcParams: Record<string, any> = {
        ...params,
        ...(ctx.additionalContext?.is_replay
          ? {
              forceUpdateSystem: true,
              ...(replayBackup ? { _replayBackup: replayBackup } : {}),
            }
          : {}),
        req,
      };

      const result = await svc.columnUpdate(ctx, svcParams as any);

      if (ctx.additionalContext?.is_replay && svcParams._columnBackup) {
        return {
          result,
          metaUpdate: { backup: svcParams._columnBackup },
        };
      }
      return result;
    },
  );

  registerForward(ColumnDeleteContract, (ctx, p) => svc.columnDelete(ctx, p));
  registerForward(ColumnSetAsPrimaryContract, (ctx, p) =>
    svc.columnSetAsPrimary(ctx, p),
  );
}
