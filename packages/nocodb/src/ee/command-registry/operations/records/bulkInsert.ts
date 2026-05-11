import {
  buildRowFromCompositePk,
  getBaseModelForModel,
  pkFromRow,
  reapplyDisplacedForward,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
  stripServerControlledFields,
} from './_shared';
import type { RecordInsertExtra } from './_shared';
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
  recordBulkInsertCaptureSchema,
  recordBulkInsertSchema,
  recordBulkInsertUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordBulkInsertContract: OperationContract<
  typeof recordBulkInsertSchema,
  RecordInsertExtra,
  unknown
> = {
  name: OperationName.recordBulkInsert,
  entity: MetaTable.MODELS,
  schema: recordBulkInsertSchema,
  sandbox: false,
  capture: ['displacedRecords', 'recordModelContext'],
  capture_schema: recordBulkInsertCaptureSchema,
  entry: {
    description: recordActions.bulkInsert,
    before: async (context, params) => {
      const resolved = await resolveModelForEntry(context, params);
      if (!resolved) return {};
      return { parentEntityTitle: resolved.model.title, extra: resolved.ctx };
    },
  },
  undo: {
    inverse: (_ctx, _params, result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const rows = Array.isArray(result) ? result : [];
      const pks: (string | number)[] = [];
      for (const r of rows) {
        if (r == null) continue;
        const pk = pkFromRow(r as Record<string, any>, resolved?.extra);
        if (pk != null) pks.push(pk);
      }
      if (!pks.length) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordBulkInsertUndo,
        params: {
          modelId,
          pks,
          displacedRecords: [...displaced],
        },
      };
    },
  },
};

export const RecordBulkInsertUndoContract: OperationContract<
  typeof recordBulkInsertUndoSchema
> = {
  name: OperationName.recordBulkInsertUndo,
  entity: MetaTable.MODELS,
  schema: recordBulkInsertUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    description: recordActions.bulkInsertUndo,
  },
};

export function registerBulkInsertHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  // `recordBulkInsert` redo. trashId → restore from trash (one entry
  // covers all rows). Otherwise → fresh insert.
  OperationRegistry.register(
    RecordBulkInsertContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        await reapplyDisplacedForward(
          context,
          meta.extra?.displacedRecords ?? [],
          meta.originalReq,
        );
        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          force: true,
        });
        return { metaUpdate: { softDeleteTrashId: null } };
      }

      const { modelId, model } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordBulkInsert',
      );
      const rows = (params.body as any[]).map((r) =>
        stripServerControlledFields(r as Record<string, any>, model.columns),
      );
      return await dataTableSvc.dataInsert(context, {
        modelId,
        body: rows,
        viewId: params.viewId as string | undefined,
        baseId: params.baseId as string | undefined,
        cookie: meta.originalReq,
        apiVersion: params.apiVersion as any,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);
    },
  );

  // `recordBulkInsertUndo` — bulk-delete + restore displaced.
  OperationRegistry.register(
    RecordBulkInsertUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      if (!model.primaryKey) return;

      const baseModel = await getBaseModelForModel(context, model);

      const deleteRows = params.pks.map((pk) =>
        buildRowFromCompositePk(String(pk), model),
      );
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete(deleteRows, {
            cookie: meta.originalReq,
          });
        } catch {
          for (const pk of params.pks) {
            try {
              await baseModel.delByPk(pk, null, meta.originalReq);
            } catch {}
          }
        }
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;

      await restoreDisplaced(
        context,
        params.displacedRecords as ReadonlyArray<DisplacedRecord>,
        meta.originalReq,
      );

      return trashId
        ? { metaUpdate: { softDeleteTrashId: trashId } }
        : undefined;
    },
  );
}
