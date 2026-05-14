import { resolveModelForEntry, scopeRecordOp } from './_shared';
import type { RecordMoveExtra } from './_shared';
import type { OperationContract } from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import {
  getTraceCapture,
  runInChildTraceScope,
} from '~/decorators/trace-command.decorator';
import {
  recordMoveCaptureSchema,
  recordMoveSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

/** `recordMove` is self-inverse: the inverse op is another recordMove
 *  with the captured pre-move neighbor as the new `beforeRowId`. The
 *  capture itself happens inside `BaseModelSqlv2.moveRecord` so redo's
 *  `runInChildTraceScope` also harvests fresh `movePrev`. */
export const RecordMoveContract: OperationContract<
  typeof recordMoveSchema,
  RecordMoveExtra,
  unknown
> = {
  name: OperationName.recordMove,
  entity: MetaTable.MODELS,
  schema: recordMoveSchema,
  sandbox: false,
  capture: ['recordModelContext', 'movePrev'],
  capture_schema: recordMoveCaptureSchema,
  entry: {
    description: recordActions.move,
    before: async (context, params) => {
      const resolved = await resolveModelForEntry(context, params, {
        fallbackToParamsModelId: true,
      });
      if (!resolved) return {};
      return {
        parentEntityTitle: resolved.model.title,
        extra: {
          modelId: resolved.ctx.modelId,
          parentEntityTitle: resolved.model.title ?? '',
        },
      };
    },
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const prev = getTraceCapture('movePrev');
      if (!prev) return null;
      return {
        name: OperationName.recordMove,
        params: {
          modelId,
          rowId: prev.pk,
          beforeRowId: prev.beforeRowId,
        },
      };
    },
    scope: scopeRecordOp,
  },
};

export function registerMoveHandlers(dataTableSvc: DataTableService): void {
  // Re-dispatches dataMove inside a child trace scope so the next
  // undo/redo cycle picks up the freshly-rotated `movePrev`.
  OperationRegistry.register(
    RecordMoveContract,
    async (context, params, meta) => {
      const { bag } = await runInChildTraceScope(async () => {
        await dataTableSvc.dataMove(context, {
          modelId: params.modelId as string,
          rowId: String(params.rowId),
          beforeRowId:
            params.beforeRowId == null ? undefined : String(params.beforeRowId),
          cookie: meta.originalReq,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
        } as any);
      });
      const freshMovePrev = bag.get('movePrev');
      return freshMovePrev
        ? { metaUpdate: { movePrev: freshMovePrev } }
        : undefined;
    },
  );
}
