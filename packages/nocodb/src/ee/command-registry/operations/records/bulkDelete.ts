import {
  buildRedoMetaUpdate,
  extractRowPk,
  getBaseModelForModel,
  logger,
  ltarKeysFromColumns,
  pickFreshestList,
  pickFreshestRows,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
  scopeRecordOp,
  stripServerControlledFields,
} from './_shared';
import type { RecordDeleteExtra } from './_shared';
import type {
  DisplacedRecord,
  OperationContract,
} from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import {
  getTraceCapture,
  runInChildTraceScope,
} from '~/decorators/trace-command.decorator';
import {
  recordBulkDeleteSchema,
  recordBulkDeleteUndoSchema,
  recordDeleteCaptureSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordBulkDeleteContract: OperationContract<
  typeof recordBulkDeleteSchema,
  RecordDeleteExtra,
  unknown
> = {
  name: OperationName.recordBulkDelete,
  entity: MetaTable.MODELS,
  schema: recordBulkDeleteSchema,
  sandbox: false,
  capture: [
    'recordModelContext',
    'recordPrev',
    'displacedRecords',
    'softDeleteTrashId',
  ],
  capture_schema: recordDeleteCaptureSchema,
  entry: {
    description: recordActions.bulkDelete,
    before: async (context, params) => {
      const resolved = await resolveModelForEntry(context, params, {
        fallbackToParamsModelId: true,
      });
      if (!resolved) return {};
      return {
        parentEntityTitle: resolved.model.title,
        extra: {
          ...resolved.ctx,
          parentEntityTitle: resolved.model.title ?? '',
        },
      };
    },
  },
  undo: {
    inverse: async (context, _params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const prevList = getTraceCapture('recordPrev') ?? [];
      if (!prevList.length) return null;
      const rows: Array<{
        pk: string | number;
        prev: Record<string, any>;
      }> = [];
      for (const prev of prevList) {
        const pk = extractRowPk(prev, model);
        if (!pk) continue;
        rows.push({ pk, prev });
      }
      if (!rows.length) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordBulkDeleteUndo,
        params: {
          modelId,
          rows,
          ...(displaced.length ? { displacedRecords: [...displaced] } : {}),
        },
      };
    },
    scope: scopeRecordOp,
  },
};

export const RecordBulkDeleteUndoContract: OperationContract<
  typeof recordBulkDeleteUndoSchema
> = {
  name: OperationName.recordBulkDeleteUndo,
  entity: MetaTable.MODELS,
  schema: recordBulkDeleteUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    description: recordActions.bulkDeleteUndo,
  },
};

export function registerBulkDeleteHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  // `recordBulkDelete` redo — re-runs bulkDelete in a child trace scope
  // to harvest fresh recordPrev / displacedRecords / softDeleteTrashId
  // for the next undo cycle.
  OperationRegistry.register(
    RecordBulkDeleteContract,
    async (context, params, meta) => {
      const { model } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordBulkDelete',
      );
      const baseModel = await getBaseModelForModel(context, model);
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete(params.body as any[], {
            cookie: meta.originalReq,
          });
        } catch {
          // Per-row fallback — rows already gone are swallowed.
          for (const row of params.body as any[]) {
            try {
              const pk = extractRowPk(row, model);
              if (!pk) continue;
              await baseModel.delByPk(pk, null, meta.originalReq);
            } catch {}
          }
        }
      });
      const metaUpdate = {
        softDeleteTrashId:
          (bag.get('softDeleteTrashId') as string | undefined) ?? null,
        ...(buildRedoMetaUpdate(bag, ['recordPrev', 'displacedRecords']) ?? {}),
      };
      return { metaUpdate };
    },
  );

  // `recordBulkDeleteUndo`. Trash path → single restore covers all rows.
  // No-trash path → batch re-insert + restore displaced.
  OperationRegistry.register(
    RecordBulkDeleteUndoContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        try {
          await baseTrashSvc.restore(context, {
            trashId,
            user: meta.originalReq?.user ?? { id: meta.createdBy },
            req: meta.originalReq,
            force: true,
          });
          return { metaUpdate: { softDeleteTrashId: null } };
        } catch (e: any) {
          logger.warn(
            `recordBulkDeleteUndo: trash restore failed (${e?.message}); ` +
              `falling back to batch re-insert from prev`,
          );
        }
      }

      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      const rowsForUndo = pickFreshestRows(meta, params, model);
      const ltarKeys = ltarKeysFromColumns(model.columns);
      const reinsertBatch: Record<string, any>[] = [];
      for (const row of rowsForUndo) {
        const stripped = stripServerControlledFields(row.prev, model.columns);
        const body: Record<string, any> = {};
        for (const [k, v] of Object.entries(stripped)) {
          if (ltarKeys.has(k)) continue;
          body[k] = v;
        }
        reinsertBatch.push(body);
      }
      if (reinsertBatch.length) {
        await dataTableSvc.dataInsert(context, {
          modelId: params.modelId,
          body: reinsertBatch,
          cookie: meta.originalReq,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          undo: true,
          internalFlags: { allowSystemColumn: true },
        } as any);
      }

      await restoreDisplaced(
        context,
        pickFreshestList<DisplacedRecord>(meta, params, 'displacedRecords'),
        meta.originalReq,
      );
    },
  );
}
