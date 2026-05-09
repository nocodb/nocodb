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
  OperationContract,
} from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
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
  recordDeleteCaptureSchema,
  recordDeleteSchema,
  recordDeleteUndoSchema,
  recordInsertCaptureSchema,
  recordInsertUndoSchema,
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
      for (const dr of params.displacedRecords) {
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

      for (const dr of params.displacedRecords) {
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
        extraDisplaced ?? params.displacedRecords ?? [];
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
        if (!extraPrevList?.length) return params.rows;
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
        extraDisplaced ?? params.displacedRecords ?? [];
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
}
