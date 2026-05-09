import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isVirtualCol,
  RelationTypes,
} from 'nocodb-sdk';
import type {
  DisplacedRecord,
  LinkChange,
  OperationContract,
} from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import type { DataAliasNestedService } from '~/services/data-alias-nested.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  captureForTrace,
  getTraceCapture,
  runInChildTraceScope,
} from '~/decorators/trace-command.decorator';
import { MetaTable } from '~/utils/globals';
import { Base, Column as ColumnModel, Model, Source } from '~/models';
import { dataWrapper } from '~/helpers/dbHelpers';
import {
  recordBulkDeleteSchema,
  recordBulkDeleteUndoSchema,
  recordBulkInsertCaptureSchema,
  recordBulkInsertSchema,
  recordBulkInsertUndoSchema,
  recordBulkUpdateCaptureSchema,
  recordBulkUpdateSchema,
  recordBulkUpdateUndoSchema,
  recordDeleteCaptureSchema,
  recordDeleteSchema,
  recordDeleteUndoSchema,
  recordInsertCaptureSchema,
  recordInsertUndoSchema,
  recordLinkSchema,
  recordMoveCaptureSchema,
  recordMoveSchema,
  recordUpdateCaptureSchema,
  recordUpdateSchema,
  recordUpdateUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const logger = new Logger('record.operations');

const recordInsertSchema = z
  .object({
    // V2 path
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    // V1 path
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    body: z.unknown(),
    cookie: z.unknown().optional(),
    undo: z.boolean().optional(),
    apiVersion: z.string().optional(),
    internalFlags: z.unknown().optional(),
    query: z.unknown().optional(),
    disableOptimization: z.boolean().optional(),
  })
  .passthrough();

interface RecordInsertExtra {
  modelId: string;
  primaryKeyTitles: string[];
}

/**
 * Resolve modelId from either v2-shape (`params.modelId`) or v1-shape
 * (`params.baseName` + `params.tableName`) params.
 */
async function resolveModelIdFromParams(
  context: any,
  params: any,
): Promise<string | undefined> {
  if (params.modelId) return params.modelId;
  if (params.tableName && params.baseName) {
    const base = await Base.getWithInfoByTitleOrId(context, params.baseName);
    if (!base) return undefined;
    const model = await Model.getByAliasOrId(context, {
      base_id: base.id,
      aliasOrId: params.tableName,
    });
    return model?.id;
  }
  return undefined;
}

export const RecordInsertContract: OperationContract<
  typeof recordInsertSchema,
  RecordInsertExtra,
  Record<string, any> | undefined
> = {
  name: OperationName.recordInsert,
  entity: MetaTable.MODELS,
  schema: recordInsertSchema,
  sandbox: false,
  capture: ['displacedRecords', 'recordModelContext'],
  capture_schema: recordInsertCaptureSchema,
  entry: {
    description: recordActions.insert,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return { parentEntityTitle: model.title, extra: ctx };
    },
    entity_id: (_params, result, resolved) => {
      if (!result || Array.isArray(result)) return undefined;
      return pkFromRow(result as Record<string, any>, resolved?.extra);
    },
    skip_if: (_ctx, params) => Array.isArray(params.body),
  },
  undo: {
    inverse: (_ctx, _params, result, resolved) => {
      if (!result || Array.isArray(result)) return null;
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const pk = pkFromRow(result as Record<string, any>, resolved?.extra);
      if (pk == null) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordInsertUndo,
        params: {
          modelId,
          pk,
          displacedRecords: [...displaced],
        },
      };
    },
  },
};

/**
 * Inverse-only primitive that reverses a `recordInsert`:
 *   1. Hard-deletes the inserted row by pk.
 *   2. Restores each captured `DisplacedRecord` (FK columns nulled or
 *      reassigned by the original insert; junction rows deleted by V2
 *      OO/OM cardinality enforcement).
 *
 * `sandbox: false` (data ops) and `undo: false` (this IS the undo).
 */
export const RecordInsertUndoContract: OperationContract<
  typeof recordInsertUndoSchema
> = {
  name: OperationName.recordInsertUndo,
  entity: MetaTable.MODELS,
  schema: recordInsertUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    entity_id: 'pk',
    description: recordActions.insertUndo,
  },
};

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
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return { parentEntityTitle: model.title, extra: ctx };
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

interface RecordDeleteExtra {
  modelId: string;
  primaryKeyTitles: string[];
  parentEntityTitle: string;
}

/** Pull the row pk out of a `recordDelete`-shape forward params object.
 *  `rowId` is already in joined form when present (v1 path). Otherwise
 *  pull it from `body` (or `body[0]` for single-array bulk) via the
 *  canonical `extractPksValue` helper. */
function extractDeletePk(params: any, model: any): string | undefined {
  if (params.rowId != null) return String(params.rowId);
  let body = params.body;
  if (Array.isArray(body)) body = body[0];
  if (!body || typeof body !== 'object') return undefined;
  const v = dataWrapper(body).extractPksValue(model, true);
  return v == null || v === 'N/A' ? undefined : String(v);
}

/** Sync composite-pk extraction for `entity_id` / inverse-builder
 *  callbacks that don't have a Model in scope — works off the
 *  `recordModelContext.primaryKeyTitles` slot.
 *
 *  Single pk → returns the value as a string.
 *  Composite pk → joins values with `___` and escapes `_` → `\_` to
 *  match `extractPksValue(model, true)`. Returns `undefined` when any
 *  pk column is missing from `row`.
 */
function pkFromRow(
  row: Record<string, any>,
  ctx?: { primaryKeyTitles?: string[] },
): string | undefined {
  const titles = ctx?.primaryKeyTitles;
  if (!titles?.length) return undefined;
  const parts = titles.map((t) => row[t]);
  if (parts.some((v) => v == null)) return undefined;
  if (parts.length === 1) return String(parts[0]);
  return parts.map((v) => String(v).replace(/_/g, '\\_')).join('___');
}

/** Convert a joined-string composite pk back into a row-shape object
 *  bulkDelete can consume. Single-pk tables map directly. Composite-pk
 *  joined strings (`"a___b"`) are split (with `\_` → `_` un-escape) and
 *  zipped with the model's pk titles in order. */
function buildRowFromCompositePk(
  pk: string,
  model: { primaryKeys: ReadonlyArray<{ title: string }> },
): Record<string, string> {
  const pks = model.primaryKeys;
  if (pks.length === 1) return { [pks[0].title]: pk };
  const parts = pk.split('___').map((v) => v.replace(/\\_/g, '_'));
  const row: Record<string, string> = {};
  for (let i = 0; i < pks.length; i++) row[pks[i].title] = parts[i];
  return row;
}

export const RecordDeleteContract: OperationContract<
  typeof recordDeleteSchema,
  RecordDeleteExtra,
  unknown
> = {
  name: OperationName.recordDelete,
  entity: MetaTable.MODELS,
  schema: recordDeleteSchema,
  sandbox: false,
  capture: [
    'recordModelContext',
    'recordPrev',
    'displacedRecords',
    'softDeleteTrashId',
  ],
  capture_schema: recordDeleteCaptureSchema,
  entry: {
    description: recordActions.delete,
    before: async (context, params) => {
      const modelId =
        params.modelId ?? (await resolveModelIdFromParams(context, params));
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return {
        parentEntityTitle: model.title,
        extra: { ...ctx, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params, _result, resolved) => {
      if (params.rowId != null) return String(params.rowId);
      let body = params.body as any;
      if (Array.isArray(body)) body = body[0];
      if (!body || typeof body !== 'object') return undefined;
      return pkFromRow(body, resolved?.extra);
    },
    skip_if: (_ctx, params) =>
      Array.isArray(params.body) && (params.body as any[]).length > 1,
  },
  undo: {
    inverse: async (context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const pk = extractDeletePk(params, model);
      if (!pk) return null;
      const prevList = getTraceCapture('recordPrev') ?? [];
      const prev =
        prevList.find(
          (r) => String(dataWrapper(r).extractPksValue(model, true)) === pk,
        ) ?? prevList[0];
      if (!prev) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordDeleteUndo,
        params: {
          modelId,
          pk,
          prev,
          ...(displaced.length ? { displacedRecords: [...displaced] } : {}),
        },
      };
    },
  },
};

export const RecordDeleteUndoContract: OperationContract<
  typeof recordDeleteUndoSchema
> = {
  name: OperationName.recordDeleteUndo,
  entity: MetaTable.MODELS,
  schema: recordDeleteUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    entity_id: (params) => String(params.pk),
    description: recordActions.deleteUndo,
  },
};

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
      const modelId =
        params.modelId ?? (await resolveModelIdFromParams(context, params));
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return {
        parentEntityTitle: model.title,
        extra: { ...ctx, parentEntityTitle: model.title ?? '' },
      };
    },
    // No `entity_id` — bulk inverse derives PKs from `recordPrev` per-row.
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
        const v = dataWrapper(prev).extractPksValue(model, true);
        if (v == null || v === 'N/A') continue;
        rows.push({ pk: String(v), prev });
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

interface RecordUpdateExtra {
  modelId: string;
  primaryKeyTitles: string[];
  parentEntityTitle: string;
}

/** Pull pk for a single-row update from forward params. v1 path uses
 *  `rowId`; v2/v3 carries the pk fields inside `body` (or `body[0]`
 *  if the bulk dispatcher routed a 1-element array here). */
function extractUpdatePk(params: any, model: any): string | undefined {
  if (params.rowId != null) return String(params.rowId);
  let body = params.body;
  if (Array.isArray(body)) body = body[0];
  if (!body || typeof body !== 'object') return undefined;
  const v = dataWrapper(body).extractPksValue(model, true);
  return v == null || v === 'N/A' ? undefined : String(v);
}

/** Strip pk titles from the update body for use as the inverse-side
 *  `body` slot. The pk lives in `pk` already; the inverse-restore
 *  payload is purely the changed non-pk fields. */
function stripPkTitles(
  body: Record<string, any>,
  primaryKeyTitles: ReadonlyArray<string>,
): Record<string, any> {
  if (!primaryKeyTitles.length) return body;
  const out: Record<string, any> = {};
  const pkSet = new Set(primaryKeyTitles);
  for (const [k, v] of Object.entries(body)) {
    if (pkSet.has(k)) continue;
    out[k] = v;
  }
  return out;
}

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
      const modelId =
        params.modelId ?? (await resolveModelIdFromParams(context, params));
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return {
        parentEntityTitle: model.title,
        extra: { ...ctx, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params, _result, resolved) => {
      if (params.rowId != null) return String(params.rowId);
      let body = params.body as any;
      if (Array.isArray(body)) body = body[0];
      if (!body || typeof body !== 'object') return undefined;
      return pkFromRow(body, resolved?.extra);
    },
    skip_if: (_ctx, params) =>
      Array.isArray(params.body) && (params.body as any[]).length > 1,
  },
  undo: {
    inverse: async (context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const pk = extractUpdatePk(params, model);
      if (!pk) return null;

      // Locate the matching prev snapshot. Bulk dispatch may funnel a
      // 1-element body[] here; pick by pk to be safe.
      const prevList = getTraceCapture('recordPrev') ?? [];
      const prev =
        prevList.find(
          (r) => String(dataWrapper(r).extractPksValue(model, true)) === pk,
        ) ?? prevList[0];
      if (!prev) return null;

      // Original body for redo, with pk titles stripped (pk lives in
      // its own slot). Single-row: body or body[0]; bulk-dispatched
      // single: body[0].
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
      const modelId =
        params.modelId ?? (await resolveModelIdFromParams(context, params));
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: model.primaryKeys.map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return {
        parentEntityTitle: model.title,
        extra: { ...ctx, parentEntityTitle: model.title ?? '' },
      };
    },
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
      const prevByPk = new Map<string, Record<string, any>>();
      for (const r of prevList) {
        const v = dataWrapper(r).extractPksValue(model, true);
        if (v != null && v !== 'N/A') prevByPk.set(String(v), r);
      }
      const pkTitles = resolved?.extra?.primaryKeyTitles ?? [];
      const rows: Array<{
        pk: string | number;
        prev: Record<string, any>;
        body: Record<string, any>;
      }> = [];
      for (const rawBody of params.body as any[]) {
        if (!rawBody || typeof rawBody !== 'object') continue;
        const v = dataWrapper(rawBody).extractPksValue(model, true);
        if (v == null || v === 'N/A') continue;
        const pk = String(v);
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

interface RecordLinkExtra {
  modelId: string;
  parentEntityTitle: string;
}

/** Pick only the serializable link-shape fields from params for the
 *  inverse op. Spreading `...params` would carry `cookie: req` (Express
 *  request, circular refs) into `inverse_params` and break JSON
 *  serialization. */
function pickLinkParams(params: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of [
    'modelId',
    'baseId',
    'viewId',
    'columnId',
    'refRowIds',
    'baseName',
    'tableName',
    'viewName',
    'columnName',
    'refRowId',
    'rowId',
  ]) {
    if (params[k] !== undefined) out[k] = params[k];
  }
  return out;
}

export const RecordLinkAddContract: OperationContract<
  typeof recordLinkSchema,
  RecordLinkExtra,
  unknown
> = {
  name: OperationName.recordLinkAdd,
  entity: MetaTable.MODELS,
  schema: recordLinkSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkAdd,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      return {
        parentEntityTitle: model.title,
        extra: { modelId, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId && !params.tableName) return null;
      // Forward all v1 + v2 link fields so the inverse takes the same
      // service path the forward op did (audit/realtime symmetry).
      // `pickLinkParams` strips `cookie`/`req` (circular refs would
      // break JSON serialization of inverse_params on the log row).
      const picked = pickLinkParams(params);
      if (modelId && !picked.modelId) picked.modelId = modelId;
      return {
        name: OperationName.recordLinkRemove,
        params: picked,
      };
    },
  },
};

export const RecordLinkRemoveContract: OperationContract<
  typeof recordLinkSchema,
  RecordLinkExtra,
  unknown
> = {
  name: OperationName.recordLinkRemove,
  entity: MetaTable.MODELS,
  schema: recordLinkSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkRemove,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      return {
        parentEntityTitle: model.title,
        extra: { modelId, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId && !params.tableName) return null;
      const picked = pickLinkParams(params);
      if (modelId && !picked.modelId) picked.modelId = modelId;
      return {
        name: OperationName.recordLinkAdd,
        params: picked,
      };
    },
  },
};

interface RecordMoveExtra {
  modelId: string;
  parentEntityTitle: string;
}

/** `recordMove` is self-inverse: the inverse op is another recordMove
 *  with the captured pre-move neighbor as the new `beforeRowId`. The
 *  capture itself happens inside `BaseModelSqlv2.moveRecord` — putting
 *  it there (rather than in `entry.before`) ensures redo's
 *  `runInChildTraceScope` also harvests fresh `movePrev`, since
 *  `entry.before` only fires for the outermost `@TraceCommand` call. */
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
      const modelId =
        params.modelId ?? (await resolveModelIdFromParams(context, params));
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const ctx = {
        modelId,
        primaryKeyTitles: (model.primaryKeys ?? []).map((c) => c.title),
      };
      captureForTrace('recordModelContext', ctx);
      return {
        parentEntityTitle: model.title,
        extra: { modelId, parentEntityTitle: model.title ?? '' },
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
  },
};

/**
 * Strip body fields the server controls. Auto-generated time/by columns
 * are unconditionally rejected by `handleValidateBulkInsert`, virtual
 * non-LTAR columns the same. Without this strip, redo of a recorded
 * body fails with "Column \"CreatedAt\" is auto generated and cannot be
 * updated" because `prepareNocoData` mutated the body before the trace
 * decorator captured it.
 */
function stripServerControlledFields(
  body: Record<string, any>,
  columns: Column[],
): Record<string, any> {
  const out: Record<string, any> = {};
  const byKey = new Map<string, Column>();
  for (const c of columns) {
    byKey.set(c.title, c);
    byKey.set(c.column_name, c);
    byKey.set(c.id, c);
  }
  for (const [k, v] of Object.entries(body)) {
    const col = byKey.get(k);
    if (col) {
      if (
        isCreatedOrLastModifiedTimeCol(col) ||
        isCreatedOrLastModifiedByCol(col)
      )
        continue;
      if (isVirtualCol(col) && !isLinksOrLTAR(col)) continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Map a captured V2 junction `DisplacedRecord` to the `(rowId, childIds)`
 * shape `addLinks` / `removeLinks` expects.
 *
 * For OO (V2) / MO: inserting row is the **child** of the relation —
 *   ownPk = junction.childValue, otherPk = junction.parentValue
 * For OM: inserting row is the **parent** side.
 */
/** Invert a captured V3 LTAR diff entry: 'add' → removeLinks,
 *  'remove' → addLinks. Resolves the owner-side baseModel via the
 *  LTAR column's owning model (NOT necessarily the operation's
 *  primary modelId — the column may live on a related table when
 *  the body update touched a foreign-table LTAR field). */
async function invertLinkChange(
  context: any,
  lc: LinkChange,
  originalReq: any,
): Promise<void> {
  const col = await ColumnModel.get(context, { colId: lc.colId });
  if (!col) return;
  const ownerModel = await col.getModel(context);
  const ownerContext = { ...context, base_id: ownerModel.base_id };
  const ownerSource = await Source.get(ownerContext, ownerModel.source_id);
  const ownerBaseModel = await Model.getBaseModelSQL(ownerContext, {
    id: ownerModel.id,
    dbDriver: await NcConnectionMgrv2.get(ownerSource),
    source: ownerSource,
  });
  const args = {
    colId: lc.colId,
    rowId: lc.rowId,
    childIds: [...lc.childIds],
    cookie: originalReq,
  };
  if (lc.op === 'add') {
    await ownerBaseModel.removeLinks(args);
  } else {
    await ownerBaseModel.addLinks(args);
  }
}

async function resolveJunctionLinkSides(
  context: any,
  dr: Extract<DisplacedRecord, { kind: 'junction' }>,
): Promise<{
  colId: string;
  rowId: string;
  childIds: (string | number)[];
  ownerBaseModel: any;
}> {
  const col = await ColumnModel.get(context, { colId: dr.colId });
  if (!col) {
    throw new Error(`junction restore: column ${dr.colId} not found`);
  }
  const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(context);
  const ownerModel = await col.getModel(context);
  const ownerContext = { ...context, base_id: ownerModel.base_id };
  const ownerSource = await Source.get(ownerContext, ownerModel.source_id);
  const ownerBaseModel = await Model.getBaseModelSQL(ownerContext, {
    id: ownerModel.id,
    dbDriver: await NcConnectionMgrv2.get(ownerSource),
    source: ownerSource,
  });

  const isOwnSideChild =
    colOpts.type === RelationTypes.ONE_TO_ONE ||
    colOpts.type === RelationTypes.MANY_TO_ONE;
  const ownPk = isOwnSideChild ? dr.childValue : dr.parentValue;
  const otherPk = isOwnSideChild ? dr.parentValue : dr.childValue;

  return {
    colId: dr.colId,
    rowId: String(ownPk),
    childIds: [otherPk],
    ownerBaseModel,
  };
}

export function registerRecordHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
  dataAliasNestedSvc: DataAliasNestedService,
): void {
  // `recordInsert` redo. With trashId → restore from trash (preserves pk).
  // Without → fresh insert.
  OperationRegistry.register(
    RecordInsertContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        // Re-apply forward displacement so trash-restore's V2 link-conflict
        // detector doesn't trip on OO/MO+OO and the post-restore state
        // matches the original post-create world.
        const displaced = meta.extra?.displacedRecords ?? [];
        for (const dr of displaced) {
          if (dr.kind === 'column') {
            // Soft-delete-snapshot entries omit `forward` (no mutation
            // to re-apply); the redo path skips them.
            if (!dr.forward) continue;
            const next = dr.forward === 'null' ? null : dr.forwardPk ?? null;
            const drModel = await Model.get(context, dr.modelId);
            if (!drModel) continue;
            const drContext = { ...context, base_id: drModel.base_id };
            await drModel.getColumns(drContext);
            if (!drModel.primaryKey) continue;
            const drSource = await Source.get(drContext, drModel.source_id);
            const drBaseModel = await Model.getBaseModelSQL(drContext, {
              id: drModel.id,
              dbDriver: await NcConnectionMgrv2.get(drSource),
              source: drSource,
            });
            // updateByPk fires afterUpdate (realtime/audit/webhook); raw fallback if column was renamed.
            try {
              await drBaseModel.updateByPk(
                dr.pk,
                { [dr.column]: next },
                null,
                meta.originalReq,
              );
            } catch (e: any) {
              const drWherePk = await drBaseModel._wherePk(dr.pk);
              await drBaseModel
                .dbDriver(drBaseModel.getTnPath(drModel.table_name))
                .update({ [dr.column]: next })
                .where(drWherePk);
            }
          } else if (dr.kind === 'junction') {
            const link = await resolveJunctionLinkSides(context, dr);
            await link.ownerBaseModel.removeLinks({
              colId: link.colId,
              rowId: link.rowId,
              childIds: link.childIds,
              cookie: meta.originalReq,
            });
          }
        }

        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          // Auto-resolve residual cardinality conflicts.
          force: true,
        });
        return { metaUpdate: { softDeleteTrashId: null } };
      }

      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(
          `recordInsert replay: could not resolve modelId. ` +
            `param keys=[${Object.keys(params).join(',')}] ` +
            `extra keys=[${Object.keys(meta.extra ?? {}).join(',')}]`,
        );
      }

      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordInsert replay: model ${modelId} not found`);
      }
      await model.getColumns(context);

      // Strip server-controlled fields and force the original pk(s) so
      // refs to the recorded id keep working. Splits joined-string
      // `meta.entityId` per pk column for composite tables.
      let body = params.body as Record<string, any> | unknown[] | undefined;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
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
      }

      return await dataTableSvc.dataInsert(context, {
        modelId,
        body,
        viewId: params.viewId as string | undefined,
        baseId: params.baseId as string | undefined,
        cookie: meta.originalReq,
        apiVersion: params.apiVersion as any,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        // `undo:true` + `allowSystemColumn` so nc_order/system cols can come through.
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);
    },
  );

  // `recordInsertUndo` — soft-delete (or hard-delete) the row + restore displaced.
  OperationRegistry.register(
    RecordInsertUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      if (!model.primaryKey) return;

      const source = await Source.get(context, model.source_id);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const { bag } = await runInChildTraceScope(async () => {
        await baseModel.delByPk(params.pk, null, meta.originalReq);
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;

      // Each displaced row may live in a different base/source.
      const displacedForUndo =
        params.displacedRecords as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch (e: any) {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }

      return trashId
        ? { metaUpdate: { softDeleteTrashId: trashId } }
        : undefined;
    },
  );

  // `recordBulkInsert` redo. trashId → restore from trash (one entry
  // covers all rows). Otherwise → fresh insert.
  OperationRegistry.register(
    RecordBulkInsertContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        const displaced = meta.extra?.displacedRecords ?? [];
        for (const dr of displaced) {
          if (dr.kind === 'column') {
            if (!dr.forward) continue;
            let next: string | null;
            if (dr.forward === 'null') {
              next = null;
            } else if (dr.forwardPk != null) {
              next = dr.forwardPk;
            } else {
              continue;
            }
            const drModel = await Model.get(context, dr.modelId);
            if (!drModel) continue;
            const drContext = { ...context, base_id: drModel.base_id };
            await drModel.getColumns(drContext);
            if (!drModel.primaryKey) continue;
            const drSource = await Source.get(drContext, drModel.source_id);
            const drBaseModel = await Model.getBaseModelSQL(drContext, {
              id: drModel.id,
              dbDriver: await NcConnectionMgrv2.get(drSource),
              source: drSource,
            });
            try {
              await drBaseModel.updateByPk(
                dr.pk,
                { [dr.column]: next },
                null,
                meta.originalReq,
              );
            } catch (e: any) {
              const drWherePk = await drBaseModel._wherePk(dr.pk);
              await drBaseModel
                .dbDriver(drBaseModel.getTnPath(drModel.table_name))
                .update({ [dr.column]: next })
                .where(drWherePk);
            }
          } else if (dr.kind === 'junction') {
            const link = await resolveJunctionLinkSides(context, dr);
            await link.ownerBaseModel.removeLinks({
              colId: link.colId,
              rowId: link.rowId,
              childIds: link.childIds,
              cookie: meta.originalReq,
            });
          }
        }

        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          force: true,
        });
        return { metaUpdate: { softDeleteTrashId: null } };
      }

      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(
          `recordBulkInsert replay: could not resolve modelId. ` +
            `param keys=[${Object.keys(params).join(',')}]`,
        );
      }
      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordBulkInsert replay: model ${modelId} not found`);
      }
      await model.getColumns(context);
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

  // `recordBulkInsertUndo` — bulk-delete + restore displaced. The child
  // trace scope harvests the trashId emitted by `afterSoftDeleteCompleted`
  // and rotates it via metaUpdate for the next redo.
  OperationRegistry.register(
    RecordBulkInsertUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      if (!model.primaryKey) return;

      const source = await Source.get(context, model.source_id);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const deleteRows = params.pks.map((pk) =>
        buildRowFromCompositePk(String(pk), model),
      );
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete(deleteRows, {
            cookie: meta.originalReq,
          });
        } catch (e: any) {
          // Per-pk fallback if some rows are already gone.
          for (const pk of params.pks) {
            try {
              await baseModel.delByPk(pk, null, meta.originalReq);
            } catch {}
          }
        }
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;

      const displacedForUndo =
        params.displacedRecords as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch (e: any) {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }

      return trashId
        ? { metaUpdate: { softDeleteTrashId: trashId } }
        : undefined;
    },
  );

  // `recordDelete` redo. Routes through bulkDelete([row]) to match the
  // forward-side audit shape (data-table.service.ts:dataDelete already
  // wraps single-row deletes in bulkDelete). Harvests fresh recordPrev /
  // displacedRecords / softDeleteTrashId from the child trace scope so
  // the NEXT undo replays against the current world (FKs, junctions,
  // trash entry are all live state from this redo).
  //
  // Swallows the row-already-gone case: if the row was deleted out-of-band
  // between undo and redo, redo's intent (row = absent) is already met.
  OperationRegistry.register(
    RecordDeleteContract,
    async (context, params, meta) => {
      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        params.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(`recordDelete replay: could not resolve modelId`);
      }
      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordDelete replay: model ${modelId} not found`);
      }
      await model.getColumns(context);
      const pk = extractDeletePk(params, model);
      if (!pk) {
        throw new Error(`recordDelete replay: could not resolve pk`);
      }
      const source = await Source.get(context, model.source_id);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });
      const deleteRow = buildRowFromCompositePk(pk, model);
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete([deleteRow], {
            cookie: meta.originalReq,
            isSingleRecordDeletion: true,
          });
        } catch (e: any) {
          // Fall back to delByPk; if THAT also fails because the row's
          // already gone, swallow — redo's end-state (row absent) holds.
          try {
            await baseModel.delByPk(pk, null, meta.originalReq);
          } catch {}
        }
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;
      const freshPrev = bag.get('recordPrev') as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
      const freshDisplaced = bag.get('displacedRecords') as
        | ReadonlyArray<DisplacedRecord>
        | undefined;
      // Rotate softDeleteTrashId to null when fresh redo didn't yield one
      // (trash disabled / hard-delete path); leave prev / displaced absent
      // when the harvest is empty so prior values aren't clobbered.
      const metaUpdate: Record<string, unknown> = {
        softDeleteTrashId: trashId ?? null,
      };
      if (freshPrev) metaUpdate.recordPrev = [...freshPrev];
      if (freshDisplaced) metaUpdate.displacedRecords = [...freshDisplaced];
      return { metaUpdate };
    },
  );

  // `recordDeleteUndo`. Trash path → restore by trashId. No-trash path →
  // re-insert prev row + restore displaced links.
  //
  // Prefers `meta.extra` over frozen `params` for prev / displacedRecords:
  // redo rotates these via metaUpdate so the second undo replays against
  // the post-redo world (FK values, junction memberships, trash entries
  // can all shift between undo/redo cycles). Falls back to `params` on
  // the first undo (no rotation has happened yet).
  OperationRegistry.register(
    RecordDeleteUndoContract,
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
          // Trash entry was purged (retention expiry, manual cleanup, etc.).
          // Clear the stale pointer and fall through to the no-trash
          // re-insert + restore-displaced path so undo still completes.
          logger.warn(
            `recordDeleteUndo: trash restore failed (${e?.message}); ` +
              `falling back to re-insert from prev`,
          );
        }
      }

      // Hard-delete fallback: re-insert prev + restore displaced.
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      // Prefer freshest prev: meta.extra.recordPrev rotated by latest redo.
      const extraPrevList = meta.extra?.recordPrev;
      const prevForUndo: Record<string, any> = (() => {
        if (!extraPrevList?.length) return params.prev as Record<string, any>;
        // Match by composite-pk joined string; fall back to first entry.
        const targetPk = String(params.pk);
        const match = extraPrevList.find(
          (r) =>
            String(dataWrapper(r).extractPksValue(model, true)) === targetPk,
        );
        return (match ?? extraPrevList[0]) as Record<string, any>;
      })();
      // prev contains nested LTAR snapshots that aren't valid insert payloads —
      // strip them. Linked state is restored separately via displacedRecords.
      const stripped = stripServerControlledFields(prevForUndo, model.columns);
      const body: Record<string, any> = {};
      const ltarKeys = new Set<string>();
      for (const c of model.columns) {
        if (isLinksOrLTAR(c)) {
          ltarKeys.add(c.title);
          ltarKeys.add(c.column_name);
          ltarKeys.add(c.id);
        }
      }
      for (const [k, v] of Object.entries(stripped)) {
        if (ltarKeys.has(k)) continue;
        body[k] = v;
      }
      // prev came from readByPk which always carries all pk cols, so the
      // body is already pk-complete. No need to split params.pk.
      await dataTableSvc.dataInsert(context, {
        modelId: params.modelId,
        body,
        cookie: meta.originalReq,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);

      // Restore displaced links — prefer rotated extra over frozen params.
      const extraDisplaced = meta.extra?.displacedRecords;
      const displacedForUndo: ReadonlyArray<DisplacedRecord> =
        (extraDisplaced ??
          params.displacedRecords ??
          []) as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch (e: any) {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }
    },
  );

  // `recordBulkDelete` redo — re-runs bulkDelete in a child trace scope
  // to harvest fresh recordPrev / displacedRecords / softDeleteTrashId.
  // bulkDelete fires its normal hooks + realtime broadcasts + audit; the
  // harvest gives the next undo a current-world snapshot to replay against.
  //
  // Per-pk fallback if some rows are already gone: bulkDelete throws on
  // the first missing row when throwExceptionIfNotExist=true (default
  // here is false, so it proceeds), but transient errors still warrant
  // fallback. Mirrors the recordBulkInsertUndo redo's per-pk safety net.
  OperationRegistry.register(
    RecordBulkDeleteContract,
    async (context, params, meta) => {
      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        params.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(`recordBulkDelete replay: could not resolve modelId`);
      }
      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordBulkDelete replay: model ${modelId} not found`);
      }
      await model.getColumns(context);
      const source = await Source.get(context, model.source_id);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete(params.body as any[], {
            cookie: meta.originalReq,
          });
        } catch (e: any) {
          // Per-row fallback: rows already gone are swallowed silently.
          for (const row of params.body as any[]) {
            try {
              const v = dataWrapper(row).extractPksValue(model, true);
              if (v == null || v === 'N/A') continue;
              await baseModel.delByPk(String(v), null, meta.originalReq);
            } catch {}
          }
        }
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;
      const freshPrev = bag.get('recordPrev') as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
      const freshDisplaced = bag.get('displacedRecords') as
        | ReadonlyArray<DisplacedRecord>
        | undefined;
      const metaUpdate: Record<string, unknown> = {
        softDeleteTrashId: trashId ?? null,
      };
      if (freshPrev) metaUpdate.recordPrev = [...freshPrev];
      if (freshDisplaced) metaUpdate.displacedRecords = [...freshDisplaced];
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
          // Trash entry was purged — fall through to batch re-insert.
          logger.warn(
            `recordBulkDeleteUndo: trash restore failed (${e?.message}); ` +
              `falling back to batch re-insert from prev`,
          );
        }
      }

      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      // Prefer rotated extra over frozen params (see recordDeleteUndo for why).
      // For bulk: extra carries the full prev list; rebuild rows[] by joining
      // with the original pk list to keep the same iteration shape.
      const extraPrevList = meta.extra?.recordPrev;
      const rowsForUndo: ReadonlyArray<{
        pk: string | number;
        prev: Record<string, any>;
      }> = (() => {
        if (!extraPrevList?.length) {
          return params.rows as ReadonlyArray<{
            pk: string | number;
            prev: Record<string, any>;
          }>;
        }
        const byPk = new Map<string, Record<string, any>>();
        for (const r of extraPrevList) {
          const v = dataWrapper(r).extractPksValue(model, true);
          if (v != null && v !== 'N/A') byPk.set(String(v), r);
        }
        return params.rows.map((r) => ({
          pk: r.pk as string | number,
          prev: (byPk.get(String(r.pk)) ?? r.prev) as Record<string, any>,
        }));
      })();

      const reinsertBatch: Record<string, any>[] = [];
      const ltarKeys = new Set<string>();
      for (const c of model.columns) {
        if (isLinksOrLTAR(c)) {
          ltarKeys.add(c.title);
          ltarKeys.add(c.column_name);
          ltarKeys.add(c.id);
        }
      }
      for (const row of rowsForUndo) {
        const stripped = stripServerControlledFields(row.prev, model.columns);
        const body: Record<string, any> = {};
        for (const [k, v] of Object.entries(stripped)) {
          if (ltarKeys.has(k)) continue;
          body[k] = v;
        }
        // prev carries all pk cols (readByPk output) — no split needed.
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

      // Restore displaced links — prefer rotated extra over frozen params.
      const extraDisplaced = meta.extra?.displacedRecords;
      const displacedForUndo: ReadonlyArray<DisplacedRecord> =
        (extraDisplaced ??
          params.displacedRecords ??
          []) as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }
    },
  );

  // `recordUpdate` redo. Re-runs `dataUpdate` in a child trace scope
  // to harvest fresh `recordPrev` / `displacedRecords` against the
  // post-redo world, so the next undo replays against current state.
  // Body keeps the original update payload (with pk fields injected
  // from `meta.entityId` if the persisted body is missing them — can
  // happen for v1 `rowId` shapes).
  OperationRegistry.register(
    RecordUpdateContract,
    async (context, params, meta) => {
      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        params.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(`recordUpdate replay: could not resolve modelId`);
      }
      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordUpdate replay: model ${modelId} not found`);
      }
      await model.getColumns(context);

      // Resolve the body for the replay. v2/v3 body carries pks already;
      // v1 path stored `rowId` separately so reassemble pks from
      // meta.entityId.
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
      const freshPrev = bag.get('recordPrev') as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
      const freshDisplaced = bag.get('displacedRecords') as
        | ReadonlyArray<DisplacedRecord>
        | undefined;
      const freshLinkChanges = bag.get('linkChanges') as
        | ReadonlyArray<LinkChange>
        | undefined;
      const metaUpdate: Record<string, unknown> = {};
      if (freshPrev) metaUpdate.recordPrev = [...freshPrev];
      if (freshDisplaced) metaUpdate.displacedRecords = [...freshDisplaced];
      if (freshLinkChanges) metaUpdate.linkChanges = [...freshLinkChanges];
      return Object.keys(metaUpdate).length ? { metaUpdate } : undefined;
    },
  );

  // `recordUpdateUndo` — restore the row by writing `prev` (changed
  // fields only, including pk titles) back via `dataUpdate`, then
  // restore any displaced links. Prefers `meta.extra.recordPrev` /
  // `displacedRecords` over the frozen `params` so a second undo
  // replays against the post-redo world (redo rotates these via
  // `metaUpdate`).
  OperationRegistry.register(
    RecordUpdateUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      const extraPrevList = meta.extra?.recordPrev;
      const prevForUndo: Record<string, any> = (() => {
        if (!extraPrevList?.length) return params.prev as Record<string, any>;
        const targetPk = String(params.pk);
        const match = extraPrevList.find(
          (r) =>
            String(dataWrapper(r).extractPksValue(model, true)) === targetPk,
        );
        return (match ?? extraPrevList[0]) as Record<string, any>;
      })();

      // `prev` already carries pk titles + non-pk changed fields; pass
      // it straight through. `dataUpdate` resolves the row by pk and
      // writes the rest. Strip server-controlled fields defensively in
      // case the snapshot included them (e.g. composite pk that overlaps
      // with a created_at title).
      // Forward apiVersion/viewId/baseId so V3 typecasting (DateTime TZ
      // branch in mapAliasToColumn is V1-only) and view-aware behavior
      // match the original update.
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

      const extraDisplaced = meta.extra?.displacedRecords;
      const displacedForUndo: ReadonlyArray<DisplacedRecord> =
        (extraDisplaced ??
          params.displacedRecords ??
          []) as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }

      // V3 LTAR diff: invert each entry against the row's current
      // baseModel so links land on the same table the forward op
      // touched. Owner side resolves via `colId` lookup so we don't
      // assume the LTAR column belongs to `params.modelId`.
      const extraLinkChanges = meta.extra?.linkChanges;
      const linkChangesForUndo: ReadonlyArray<LinkChange> = (extraLinkChanges ??
        params.linkChanges ??
        []) as ReadonlyArray<LinkChange>;
      for (const lc of linkChangesForUndo) {
        await invertLinkChange(context, lc, meta.originalReq);
      }
    },
  );

  // `recordBulkUpdate` redo — re-runs `dataUpdate(body[])` in a child
  // trace scope to harvest fresh per-row prev + displacedRecords for
  // the next undo cycle. Same metaUpdate rotation as recordUpdate.
  OperationRegistry.register(
    RecordBulkUpdateContract,
    async (context, params, meta) => {
      const persistedCtx = meta.extra?.recordModelContext;
      const modelId =
        persistedCtx?.modelId ??
        params.modelId ??
        (await resolveModelIdFromParams(context, params));
      if (!modelId) {
        throw new Error(`recordBulkUpdate replay: could not resolve modelId`);
      }
      const model = await Model.get(context, modelId);
      if (!model) {
        throw new Error(`recordBulkUpdate replay: model ${modelId} not found`);
      }
      await model.getColumns(context);

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
      const freshPrev = bag.get('recordPrev') as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
      const freshDisplaced = bag.get('displacedRecords') as
        | ReadonlyArray<DisplacedRecord>
        | undefined;
      const freshLinkChanges = bag.get('linkChanges') as
        | ReadonlyArray<LinkChange>
        | undefined;
      const metaUpdate: Record<string, unknown> = {};
      if (freshPrev) metaUpdate.recordPrev = [...freshPrev];
      if (freshDisplaced) metaUpdate.displacedRecords = [...freshDisplaced];
      if (freshLinkChanges) metaUpdate.linkChanges = [...freshLinkChanges];
      return Object.keys(metaUpdate).length ? { metaUpdate } : undefined;
    },
  );

  // `recordBulkUpdateUndo` — restore each row by writing its `prev`
  // back. Mirrors recordBulkDeleteUndo's rotation pattern: prefer
  // rotated `meta.extra.recordPrev` over frozen `params.rows[].prev`
  // so a second undo lands on current-world snapshots.
  OperationRegistry.register(
    RecordBulkUpdateUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);

      const extraPrevList = meta.extra?.recordPrev;
      const rowsForUndo: ReadonlyArray<{
        pk: string | number;
        prev: Record<string, any>;
      }> = (() => {
        if (!extraPrevList?.length) {
          return params.rows.map((r) => ({ pk: r.pk, prev: r.prev }));
        }
        const byPk = new Map<string, Record<string, any>>();
        for (const r of extraPrevList) {
          const v = dataWrapper(r).extractPksValue(model, true);
          if (v != null && v !== 'N/A') byPk.set(String(v), r);
        }
        return params.rows.map((r) => ({
          pk: r.pk,
          prev: byPk.get(String(r.pk)) ?? r.prev,
        }));
      })();

      const updateBatch: Record<string, any>[] = [];
      for (const row of rowsForUndo) {
        const stripped = stripServerControlledFields(row.prev, model.columns);
        updateBatch.push(stripped);
      }
      if (updateBatch.length) {
        // Forward apiVersion/viewId/baseId — see recordUpdateUndo.
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

      const extraDisplaced = meta.extra?.displacedRecords;
      const displacedForUndo: ReadonlyArray<DisplacedRecord> =
        (extraDisplaced ??
          params.displacedRecords ??
          []) as ReadonlyArray<DisplacedRecord>;
      for (const dr of displacedForUndo) {
        if (dr.kind === 'column') {
          const drModel = await Model.get(context, dr.modelId);
          if (!drModel) continue;
          const drContext = { ...context, base_id: drModel.base_id };
          await drModel.getColumns(drContext);
          if (!drModel.primaryKey) continue;
          const drSource = await Source.get(drContext, drModel.source_id);
          const drBaseModel = await Model.getBaseModelSQL(drContext, {
            id: drModel.id,
            dbDriver: await NcConnectionMgrv2.get(drSource),
            source: drSource,
          });
          try {
            await drBaseModel.updateByPk(
              dr.pk,
              { [dr.column]: dr.prev },
              null,
              meta.originalReq,
            );
          } catch {
            const drWherePk = await drBaseModel._wherePk(dr.pk);
            await drBaseModel
              .dbDriver(drBaseModel.getTnPath(drModel.table_name))
              .update({ [dr.column]: dr.prev })
              .where(drWherePk);
          }
        } else if (dr.kind === 'junction') {
          const link = await resolveJunctionLinkSides(context, dr);
          await link.ownerBaseModel.addLinks({
            colId: link.colId,
            rowId: link.rowId,
            childIds: link.childIds,
            cookie: meta.originalReq,
          });
        }
      }

      const extraLinkChanges = meta.extra?.linkChanges;
      const linkChangesForUndo: ReadonlyArray<LinkChange> = (extraLinkChanges ??
        params.linkChanges ??
        []) as ReadonlyArray<LinkChange>;
      for (const lc of linkChangesForUndo) {
        await invertLinkChange(context, lc, meta.originalReq);
      }
    },
  );
  // Both link contracts dispatch to v1 (`relationData*` → `addChild` /
  // `removeChild`) when v1 params are present, else v2 (`nestedLink` /
  // `nestedUnlink` → `addLinks` / `removeLinks`). Routing on shape
  // keeps the inverse on the same audit/realtime path the forward op
  // used.
  const isV1LinkParams = (p: any): boolean =>
    !!(p.tableName && p.columnName && p.refRowId !== undefined);

  OperationRegistry.register(
    RecordLinkAddContract,
    async (context, params, meta) => {
      if (isV1LinkParams(params)) {
        return await dataAliasNestedSvc.relationDataAdd(context, {
          baseName: params.baseName as string,
          tableName: params.tableName as string,
          viewName: params.viewName as string,
          columnName: params.columnName as string,
          rowId: String(params.rowId),
          refRowId: String(params.refRowId),
          cookie: meta.originalReq,
        } as any);
      }
      return await dataTableSvc.nestedLink(context, {
        modelId: params.modelId as string,
        viewId: params.viewId as string,
        columnId: params.columnId as string,
        rowId: String(params.rowId),
        refRowIds: params.refRowIds as any,
        cookie: meta.originalReq,
        query: params.query,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
      } as any);
    },
  );

  OperationRegistry.register(
    RecordLinkRemoveContract,
    async (context, params, meta) => {
      if (isV1LinkParams(params)) {
        return await dataAliasNestedSvc.relationDataRemove(context, {
          baseName: params.baseName as string,
          tableName: params.tableName as string,
          viewName: params.viewName as string,
          columnName: params.columnName as string,
          rowId: String(params.rowId),
          refRowId: String(params.refRowId),
          cookie: meta.originalReq,
        } as any);
      }
      return await dataTableSvc.nestedUnlink(context, {
        modelId: params.modelId as string,
        viewId: params.viewId as string,
        columnId: params.columnId as string,
        rowId: String(params.rowId),
        refRowIds: params.refRowIds as any,
        cookie: meta.originalReq,
        query: params.query,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
      } as any);
    },
  );

  // recordMove — re-dispatches dataMove inside a child trace scope so
  // the next undo/redo cycle picks up the freshly-rotated `movePrev`
  // (the row's new neighbor in the post-redo world).
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
      const freshMovePrev = bag.get('movePrev')
      return freshMovePrev
        ? { metaUpdate: { movePrev: freshMovePrev } }
        : undefined;
    },
  );
}
