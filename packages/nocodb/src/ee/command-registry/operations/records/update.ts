import {
  buildRedoMetaUpdate,
  buildRowFromCompositePk,
  entityIdFromRowOrBody,
  extractRowPk,
  extractRowPkFromParams,
  invertLinkChange,
  isNoOpRecordPrev,
  pickFreshestList,
  pickFreshestPrev,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
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
  recordUpdateCaptureSchema,
  recordUpdateSchema,
  recordUpdateUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordUpdateContract: OperationContract<
  typeof recordUpdateSchema,
  RecordUpdateExtra,
  unknown
> = {
  name: OperationName.recordUpdate,
  entity: MetaTable.MODELS,
  schema: recordUpdateSchema,
  sandbox: false,
  capture: [
    'recordModelContext',
    'recordPrev',
    'displacedRecords',
    'linkChanges',
  ],
  capture_schema: recordUpdateCaptureSchema,
  entry: {
    description: recordActions.update,
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
    entity_id: entityIdFromRowOrBody,
    skip_if: (_ctx, params, _result, resolved) => {
      if (Array.isArray(params.body) && (params.body as any[]).length > 1) {
        return true;
      }
      return isNoOpRecordPrev(resolved?.extra?.primaryKeyTitles);
    },
  },
  undo: {
    inverse: async (context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const pk = extractRowPkFromParams(params, model);
      if (!pk) return null;

      // Bulk dispatch may funnel a 1-element body[] here; pick by pk.
      const prevList = getTraceCapture('recordPrev') ?? [];
      const prev =
        prevList.find((r) => extractRowPk(r, model) === pk) ?? prevList[0];
      if (!prev) return null;

      let bodyRaw = params.body as any;
      if (Array.isArray(bodyRaw)) bodyRaw = bodyRaw[0];
      if (!bodyRaw || typeof bodyRaw !== 'object') return null;
      const body = stripPkTitles(
        bodyRaw as Record<string, any>,
        resolved?.extra?.primaryKeyTitles ?? [],
      );

      const displaced = getTraceCapture('displacedRecords') ?? [];
      const linkChanges = getTraceCapture('linkChanges') ?? [];
      return {
        name: OperationName.recordUpdateUndo,
        params: {
          modelId,
          pk,
          prev,
          body,
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
  },
};

export const RecordUpdateUndoContract: OperationContract<
  typeof recordUpdateUndoSchema
> = {
  name: OperationName.recordUpdateUndo,
  entity: MetaTable.MODELS,
  schema: recordUpdateUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    entity_id: (params) => String(params.pk),
    description: recordActions.updateUndo,
  },
};

export function registerUpdateHandlers(dataTableSvc: DataTableService): void {
  // `recordUpdate` redo — re-runs dataUpdate in a child trace scope to
  // harvest fresh recordPrev / displacedRecords / linkChanges against
  // the post-redo world for the next undo cycle.
  OperationRegistry.register(
    RecordUpdateContract,
    async (context, params, meta) => {
      const { modelId, model, persistedCtx } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordUpdate',
      );

      // v2/v3 body carries pks already; v1 path stored `rowId` separately
      // so reassemble pks from meta.entityId.
      let body = params.body as Record<string, any> | unknown[] | undefined;
      if (Array.isArray(body)) body = body[0] as Record<string, any>;
      if (!body || typeof body !== 'object') {
        throw new Error(`recordUpdate replay: missing body`);
      }
      body = stripServerControlledFields(
        body as Record<string, any>,
        model.columns,
      );
      if (meta.entityId && persistedCtx?.primaryKeyTitles?.length) {
        const row = buildRowFromCompositePk(meta.entityId, model);
        for (const [k, v] of Object.entries(row)) {
          if ((body as Record<string, any>)[k] == null) {
            (body as Record<string, any>)[k] = v;
          }
        }
      }

      const { bag } = await runInChildTraceScope(async () => {
        await dataTableSvc.dataUpdate(context, {
          modelId,
          body,
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

  // `recordUpdateUndo` — restore the row by writing `prev` (changed
  // fields + pk titles) back, then invert displaced + link changes.
  // Prefers rotated `meta.extra` over frozen `params`.
  OperationRegistry.register(
    RecordUpdateUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      const prevForUndo = pickFreshestPrev(meta, params, model);
      const stripped = stripServerControlledFields(prevForUndo, model.columns);
      await dataTableSvc.dataUpdate(context, {
        modelId: params.modelId,
        body: stripped,
        cookie: meta.originalReq,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        internalFlags: { allowSystemColumn: true },
        ...(params.apiVersion ? { apiVersion: params.apiVersion as any } : {}),
        ...(params.viewId ? { viewId: params.viewId } : {}),
        ...(params.baseId ? { baseId: params.baseId } : {}),
      } as any);

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
