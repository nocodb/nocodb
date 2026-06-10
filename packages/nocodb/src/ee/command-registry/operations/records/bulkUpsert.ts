import {
  buildRowFromCompositePk,
  bulkDeleteWithPerRowFallback,
  extractRowPk,
  getBaseModelForModel,
  resolveModelForEntry,
  resolveReplayModel,
  scopeRecordOp,
  stripServerControlledFields,
} from './_shared';
import type { RecordBulkUpsertExtra } from './_shared';
import type { OperationContract } from '~/command-registry/types';
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
  recordBulkUpsertCaptureSchema,
  recordBulkUpsertSchema,
  recordBulkUpsertUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordBulkUpsertContract: OperationContract<
  typeof recordBulkUpsertSchema,
  RecordBulkUpsertExtra,
  unknown
> = {
  name: OperationName.recordBulkUpsert,
  entity: MetaTable.MODELS,
  schema: recordBulkUpsertSchema,
  sandbox: false,
  capture: ['recordModelContext', 'upsertChanges', 'softDeleteTrashId'],
  capture_schema: recordBulkUpsertCaptureSchema,
  entry: {
    description: recordActions.bulkUpsert,
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
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const changes = getTraceCapture('upsertChanges') ?? [];
      if (!changes.length) return null;
      const updates: Array<{
        pk: string | number;
        prev: Record<string, unknown>;
      }> = [];
      const insertPks: Array<string | number> = [];
      for (const c of changes) {
        if (c.kind === 'update') {
          updates.push({ pk: c.pk, prev: c.prev });
        } else {
          insertPks.push(c.pk);
        }
      }
      if (!updates.length && !insertPks.length) return null;
      return {
        name: OperationName.recordBulkUpsertUndo,
        params: {
          modelId,
          updates,
          insertPks,
          ...(params.apiVersion ? { apiVersion: params.apiVersion } : {}),
          ...(params.viewId ? { viewId: params.viewId as string } : {}),
          ...(params.baseId ? { baseId: params.baseId as string } : {}),
        },
      };
    },
    scope: scopeRecordOp,
  },
};

export const RecordBulkUpsertUndoContract: OperationContract<
  typeof recordBulkUpsertUndoSchema
> = {
  name: OperationName.recordBulkUpsertUndo,
  entity: MetaTable.MODELS,
  schema: recordBulkUpsertUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    description: recordActions.bulkUpsertUndo,
  },
};

export function registerBulkUpsertHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  // `recordBulkUpsert` redo. Trash-restore is required when redoing a
  // user-tab undo so the originally-inserted rows come back with their
  // original pks (re-running upsert would assign new auto-pks and break
  // any references). Sandbox replay has no trashId — re-runs the upsert
  // against current world and harvests fresh `upsertChanges`.
  OperationRegistry.register(
    RecordBulkUpsertContract,
    async (context, params, meta) => {
      const { modelId, model } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordBulkUpsert',
      );
      const baseModel = await getBaseModelForModel(context, model);

      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          options: { force: true },
        });

        const captured = meta.extra?.upsertChanges ?? [];
        const updatePkSet = new Set(
          captured.filter((c) => c.kind === 'update').map((c) => String(c.pk)),
        );
        const updateBodies = ((params.body ?? []) as Record<string, any>[])
          .filter((r) => {
            const pk = extractRowPk(r, model);
            return pk != null && updatePkSet.has(pk);
          })
          .map((r) => stripServerControlledFields(r, model.columns));

        if (updateBodies.length) {
          await dataTableSvc.dataUpdate(context, {
            modelId,
            body: updateBodies,
            viewId: params.viewId as string | undefined,
            baseId: params.baseId as string | undefined,
            cookie: meta.originalReq,
            apiVersion: params.apiVersion as any,
            user: meta.originalReq?.user ?? { id: meta.createdBy },
            internalFlags: { allowSystemColumn: true },
          } as any);
        }

        return { metaUpdate: { softDeleteTrashId: null } };
      }

      const rows = (params.body as Record<string, any>[]).map((r) =>
        stripServerControlledFields(r, model.columns),
      );
      const { bag } = await runInChildTraceScope(async () => {
        await baseModel.bulkUpsert(rows, {
          cookie: meta.originalReq,
          undo: true,
        });
      });
      const freshChanges = bag.get('upsertChanges') as
        | ReadonlyArray<
            | {
                kind: 'update';
                pk: string | number;
                prev: Record<string, unknown>;
              }
            | { kind: 'insert'; pk: string | number }
          >
        | undefined;
      return freshChanges
        ? { metaUpdate: { upsertChanges: [...freshChanges] } }
        : undefined;
    },
  );

  OperationRegistry.register(
    RecordBulkUpsertUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      if (!model.primaryKey) return;

      const baseModel = await getBaseModelForModel(context, model);

      let trashId: string | undefined;
      let failedDeletePks: string[] = [];
      if (params.insertPks.length) {
        const deleteRows = params.insertPks.map((pk) =>
          buildRowFromCompositePk(String(pk), model),
        );
        const { bag } = await runInChildTraceScope(async () => {
          const result = await bulkDeleteWithPerRowFallback({
            baseModel,
            rows: deleteRows,
            pks: params.insertPks,
            cookie: meta.originalReq,
            opName: 'recordBulkUpsertUndo',
          });
          failedDeletePks = result.failedPks;
        });
        trashId = bag.get('softDeleteTrashId') as string | undefined;
      }

      if (params.updates.length) {
        const updateBatch = params.updates.map((u) =>
          stripServerControlledFields(
            u.prev as Record<string, any>,
            model.columns,
          ),
        );
        await dataTableSvc.dataUpdate(context, {
          modelId: params.modelId,
          body: updateBatch,
          cookie: meta.originalReq,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          internalFlags: { allowSystemColumn: true },
          ...(params.apiVersion
            ? { apiVersion: params.apiVersion as any }
            : {}),
          ...(params.viewId ? { viewId: params.viewId } : {}),
          ...(params.baseId ? { baseId: params.baseId } : {}),
        } as any);
      }

      const metaUpdate = {
        ...(trashId ? { softDeleteTrashId: trashId } : {}),
        ...(failedDeletePks.length ? { failedDeletePks: failedDeletePks } : {}),
      };
      return Object.keys(metaUpdate).length ? { metaUpdate } : undefined;
    },
  );
}
