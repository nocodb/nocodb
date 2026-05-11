import {
  buildRedoMetaUpdate,
  extractRowPk,
  indexRowsByPk,
  invertLinkChange,
  isNoOpRecordPrev,
  pickFreshestList,
  pickFreshestRows,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
  scopeRecordOp,
  stripPkTitles,
  stripServerControlledFields,
} from './_shared';
import type { RecordUpdateExtra } from './_shared';
import type {
  DisplacedRecord,
  LinkChange,
  OperationContract,
} from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import {
  getTraceCapture,
  runInChildTraceScope,
} from '~/decorators/trace-command.decorator';
import {
  recordBulkUpdateCaptureSchema,
  recordBulkUpdateSchema,
  recordBulkUpdateUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordBulkUpdateContract: OperationContract<
  typeof recordBulkUpdateSchema,
  RecordUpdateExtra,
  unknown
> = {
  name: OperationName.recordBulkUpdate,
  entity: MetaTable.MODELS,
  schema: recordBulkUpdateSchema,
  sandbox: false,
  capture: [
    'recordModelContext',
    'recordPrev',
    'displacedRecords',
    'linkChanges',
  ],
  capture_schema: recordBulkUpdateCaptureSchema,
  entry: {
    description: recordActions.bulkUpdate,
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
    skip_if: (_ctx, _params, _result, resolved) =>
      isNoOpRecordPrev(resolved?.extra?.primaryKeyTitles),
  },
  undo: {
    inverse: async (context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const prevList = getTraceCapture('recordPrev') ?? [];
      if (!prevList.length) return null;

      // Pair each input row with its matching prev snapshot by pk.
      // Drop rows where either side is missing (e.g. row was missing
      // when bulkUpdate ran with throwExceptionIfNotExist=false).
      const prevByPk = indexRowsByPk(prevList, model);
      const pkTitles = resolved?.extra?.primaryKeyTitles ?? [];
      const rows: Array<{
        pk: string | number;
        prev: Record<string, any>;
        body: Record<string, any>;
      }> = [];
      for (const rawBody of params.body as any[]) {
        if (!rawBody || typeof rawBody !== 'object') continue;
        const pk = extractRowPk(rawBody, model);
        if (!pk) continue;
        const prev = prevByPk.get(pk);
        if (!prev) continue;
        rows.push({
          pk,
          prev,
          body: stripPkTitles(rawBody as Record<string, any>, pkTitles),
        });
      }
      if (!rows.length) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      const linkChanges = getTraceCapture('linkChanges') ?? [];
      return {
        name: OperationName.recordBulkUpdateUndo,
        params: {
          modelId,
          rows,
          ...(displaced.length ? { displacedRecords: [...displaced] } : {}),
          ...(linkChanges.length ? { linkChanges: [...linkChanges] } : {}),
          ...(params.apiVersion
            ? { apiVersion: params.apiVersion as string }
            : {}),
          ...(params.viewId ? { viewId: params.viewId as string } : {}),
          ...(params.baseId ? { baseId: params.baseId as string } : {}),
        },
      };
    },
    scope: scopeRecordOp,
  },
};

export const RecordBulkUpdateUndoContract: OperationContract<
  typeof recordBulkUpdateUndoSchema
> = {
  name: OperationName.recordBulkUpdateUndo,
  entity: MetaTable.MODELS,
  schema: recordBulkUpdateUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    description: recordActions.bulkUpdateUndo,
  },
};

export function registerBulkUpdateHandlers(
  dataTableSvc: DataTableService,
): void {
  // `recordBulkUpdate` redo — re-runs `dataUpdate(body[])` in a child
  // trace scope to harvest fresh per-row prev + displacedRecords for
  // the next undo cycle.
  OperationRegistry.register(
    RecordBulkUpdateContract,
    async (context, params, meta) => {
      const { modelId, model } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordBulkUpdate',
      );

      const rows = (params.body as any[]).map((r) =>
        stripServerControlledFields(r as Record<string, any>, model.columns),
      );

      const { bag } = await runInChildTraceScope(async () => {
        await dataTableSvc.dataUpdate(context, {
          modelId,
          body: rows,
          viewId: params.viewId as string | undefined,
          baseId: params.baseId as string | undefined,
          cookie: meta.originalReq,
          apiVersion: params.apiVersion as any,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          internalFlags: { allowSystemColumn: true },
        } as any);
      });
      const metaUpdate = buildRedoMetaUpdate(bag, [
        'recordPrev',
        'displacedRecords',
        'linkChanges',
      ]);
      return metaUpdate ? { metaUpdate } : undefined;
    },
  );

  // `recordBulkUpdateUndo` — restore each row by writing its `prev`
  // back. Prefers rotated `meta.extra.recordPrev` over frozen
  // `params.rows[].prev` so a second undo lands on current-world
  // snapshots.
  OperationRegistry.register(
    RecordBulkUpdateUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      const rowsForUndo = pickFreshestRows(meta, params, model);
      const updateBatch = rowsForUndo.map((row) =>
        stripServerControlledFields(row.prev, model.columns),
      );
      if (updateBatch.length) {
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

      await restoreDisplaced(
        context,
        pickFreshestList<DisplacedRecord>(meta, params, 'displacedRecords'),
        meta.originalReq,
      );

      for (const lc of pickFreshestList<LinkChange>(
        meta,
        params,
        'linkChanges',
      )) {
        await invertLinkChange(context, lc, meta.originalReq);
      }
    },
  );
}
