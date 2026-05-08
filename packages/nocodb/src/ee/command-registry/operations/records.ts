import { z } from 'zod';
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isDeletedCol,
  isLinksOrLTAR,
  isVirtualCol,
  RelationTypes,
  UITypes,
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
} from '~/decorators/trace-command.decorator';
import { MetaTable } from '~/utils/globals';
import { Base, Column as ColumnModel, Model, Source } from '~/models';
import BaseTrash from '~/ee/models/BaseTrash';
import {
  recordInsertCaptureSchema,
  recordInsertUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { buildRecordResourceId } from '~/services/base-trash/record-trash.helpers';
import { recordActions } from '~/decorators/trace-command-descriptions';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

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
  primaryKeyTitle: string;
  primaryKeyColumnName: string;
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
  capture: ['displacedRecords', 'recordInsertContext'],
  capture_schema: recordInsertCaptureSchema,
  entry: {
    description: recordActions.insert,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      await model.getColumns(context);
      const pk = model.primaryKey;
      const ctx = {
        modelId,
        primaryKeyTitle: pk?.title ?? '',
        primaryKeyColumnName: pk?.column_name ?? '',
      };
      captureForTrace('recordInsertContext', ctx);
      // Surface the table title as `parentEntityTitle` so the description
      // helper can render `Insert record in {bTable(parent)}`.
      return { parentEntityTitle: model.title, extra: ctx };
    },
    entity_id: (_params, result, resolved) => {
      if (!result || Array.isArray(result)) return undefined;
      const pkTitle = resolved?.extra?.primaryKeyTitle;
      if (pkTitle && (result as Record<string, any>)[pkTitle] != null) {
        return String((result as Record<string, any>)[pkTitle]);
      }
      const id = (result as Record<string, any>).id;
      return id != null ? String(id) : undefined;
    },
    // Bulk inserts go through `recordBulkInsert` (separate contract).
    skip_if: (_ctx, params) => Array.isArray(params.body),
  },
  undo: {
    inverse: (_ctx, _params, result, resolved) => {
      if (!result || Array.isArray(result)) return null;
      const modelId = resolved?.extra?.modelId;
      const pkTitle = resolved?.extra?.primaryKeyTitle;
      if (!modelId || !pkTitle) return null;
      const pkValue = (result as Record<string, any>)[pkTitle];
      if (pkValue == null) return null;
      const displaced =
        (getTraceCapture('displacedRecords') as
          | ReadonlyArray<DisplacedRecord>
          | undefined) ?? [];
      return {
        name: OperationName.recordInsertUndo,
        params: {
          modelId,
          pk: String(pkValue),
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
 * shape `addLinks` / `removeLinks` expects, by looking up the LTAR
 * column's relation type and resolving which side of the junction is
 * "ours" (the inserting model's side).
 *
 * Returns the inserting model's baseModel + the row/child mapping +
 * the colId, so callers can fire `addLinks` / `removeLinks` to get
 * realtime + audit + webhooks for free.
 *
 * For OO (V2) / MO: inserting row is the **child** of the relation —
 *   ownPk = junction.childValue, otherPk = junction.parentValue
 * For OM: inserting row is the **parent** of the relation —
 *   ownPk = junction.parentValue, otherPk = junction.childValue
 */
async function resolveJunctionLinkSides(
  context: any,
  dr: Extract<DisplacedRecord, { kind: 'junction' }>,
): Promise<{
  colId: string;
  rowId: string;
  childIds: (string | number)[];
  ownerBaseModel: any;
} | null> {
  if (!dr.colId) return null;
  const col = await ColumnModel.get(context, { colId: dr.colId });
  if (!col) return null;
  const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(context);
  if (!colOpts) return null;

  // The LTAR col lives on the inserting model. baseModel for that side
  // is what addLinks/removeLinks need.
  const ownerModel = await ColumnModel.get(context, { colId: dr.colId }).then(
    (c) => c?.getModel(context),
  );
  if (!ownerModel) return null;
  const ownerContext = { ...context, base_id: ownerModel.base_id };
  const ownerSource = await Source.get(ownerContext, ownerModel.source_id);
  const ownerBaseModel = await Model.getBaseModelSQL(ownerContext, {
    id: ownerModel.id,
    dbDriver: await NcConnectionMgrv2.get(ownerSource),
    source: ownerSource,
  });

  // For V2 OO / MO: forward path collapses OO→MO (preparator line 89-92)
  // and the inserting row is the **child** side of the junction.
  // For V2 OM: inserting row is the **parent** side.
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

async function isRecordTrashEnabled(
  context: any,
  model: any,
  source: any,
): Promise<boolean> {
  const deletedColumn = (model.columns ?? []).find((c: Column) =>
    isDeletedCol(c),
  );
  if (!deletedColumn) return false;
  if (!source?.isMeta?.()) return false;
  return await model.isTrashEnabledForWorkspace(context);
}

export function registerRecordHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  // Forward op `recordInsert` — only invoked during REPLAY (redo of an
  // undone insert). The original user-facing call records via the
  // service-level `@TraceCommand`, never through this handler.
  //
  // Two paths depending on undo strategy:
  //   - if undo trashed the row (meta.extra.trashId present) → restore
  //     from trash via baseTrashSvc; row + pk preserved end-to-end.
  //   - else (trash wasn't enabled at undo time) → fresh insert;
  //     auto-generated columns stripped + `undo:true` so nc_order/etc.
  //     can come through the validator.
  OperationRegistry.register(
    RecordInsertContract,
    async (context, params, meta) => {
      const trashId = (meta.extra as any)?.trashId as string | undefined;
      if (trashId) {
        // Pre-clean: re-apply the original forward displacement state so
        // (a) `baseTrashSvc.restore`'s V2 link-conflict detector doesn't
        //     fire (or fires harmlessly) for OO/MO+OO scenarios, and
        // (b) the user-visible state after redo matches the original
        //     post-create world. Without this, undo's prev-restore would
        //     leak through redo: column FKs would still point at their
        //     pre-create values, junction rows would duplicate.
        const displaced =
          ((meta.extra as any)?.displacedRecords as
            | ReadonlyArray<DisplacedRecord>
            | undefined) ?? [];
        for (const dr of displaced) {
          if (dr.kind === 'column') {
            // Skip if the original capture didn't tag a forward action
            // (older log entries from before this field existed).
            if (!dr.forward) continue;
            const next = dr.forward === 'null' ? null : meta.entityId ?? null;
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
            // Route through updateByPk so the change fires afterUpdate
            // (realtime broadcast + audit + webhooks). Falls back to
            // raw UPDATE if the column isn't resolvable by name (column
            // renamed since the log row was written, etc.).
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
            // Forward had DELETED this junction row; undo re-INSERTed it.
            // Redo deletes it again so the only surviving link is the
            // forward-inserted one (parent → newRowPk). Route through
            // `removeLinks` for realtime + audit + webhook fan-out;
            // fall back to raw DELETE only when colId wasn't captured.
            const link = await resolveJunctionLinkSides(context, dr);
            if (link) {
              try {
                await link.ownerBaseModel.removeLinks({
                  colId: link.colId,
                  rowId: link.rowId,
                  childIds: link.childIds,
                  cookie: meta.originalReq,
                });
                continue;
              } catch (e: any) {
                // fall through to raw DELETE
              }
            }
            const mmModel = await Model.get(context, dr.mmModelId);
            if (!mmModel) continue;
            const mmContext = { ...context, base_id: mmModel.base_id };
            const mmSource = await Source.get(mmContext, mmModel.source_id);
            const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
              id: mmModel.id,
              dbDriver: await NcConnectionMgrv2.get(mmSource),
              source: mmSource,
            });
            await mmBaseModel
              .dbDriver(mmBaseModel.getTnPath(mmModel.table_name))
              .where(dr.parentMMCol, dr.parentValue)
              .where(dr.childMMCol, dr.childValue)
              .del();
          }
        }

        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          // `force: true` so any residual cardinality conflict (e.g.
          // log entries written before the `forward` tag existed and we
          // couldn't pre-clean) gets auto-resolved instead of throwing.
          force: true,
        });
        // BaseTrash row is gone after restore — clear the pointer so a
        // future undo→redo cycle won't try to use a stale id.
        return { metaUpdate: { trashId: null } };
      }

      // Fresh-insert fallback for the non-trash path.
      const persistedCtx = (meta.extra as any)?.recordInsertContext as
        | { modelId: string; primaryKeyTitle: string }
        | undefined;
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

      // Strip server-controlled fields (CreatedAt/UpdatedAt/CreatedBy/
      // virtual non-LTAR) from the body, then force the original pk so
      // refs to the recorded id keep working. Only applies to
      // single-row inserts; bulk goes through `recordBulkInsert`.
      let body = params.body as Record<string, any> | unknown[] | undefined;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        body = stripServerControlledFields(
          body as Record<string, any>,
          model.columns,
        );
        const pkTitle = model.primaryKey?.title;
        if (
          pkTitle &&
          meta.entityId &&
          (body as Record<string, any>)[pkTitle] == null
        ) {
          (body as Record<string, any>)[pkTitle] = meta.entityId;
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
        // `undo:true` lets nc_order pass `col.system && !allowSystemColumn`
        // gate; otherwise validator throws on system fields in the body.
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);
    },
  );

  // Inverse-only primitive. When trash is enabled for the table:
  //   - delegate to `baseModel.delByPk` which auto-routes through the
  //     soft-delete path (sets deleted=true, writes BaseTrash entry,
  //     fires realtime + audit hooks).
  //   - look up the just-created BaseTrash entry and stash its id in
  //     `metaUpdate` so redo can restore via `baseTrashSvc.restore`.
  // When trash is NOT enabled, hard-delete via raw dbDriver.
  // Either way, restore each captured `DisplacedRecord`.
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

      const trashEnabled = await isRecordTrashEnabled(context, model, source);
      let trashId: string | undefined;

      if (trashEnabled) {
        // Soft-delete via the standard path so the trash UI sees the
        // row, file references get soft-deleted, and linked-record
        // notifications fire.
        await baseModel.delByPk(params.pk, null, meta.originalReq);

        // BaseTrash entries for records key off `(tableId, deletedBy,
        // deletedAtIso)` — there is no row-pk in the resource_id, so a
        // "latest by table+user" lookup is racy (picks up older
        // unrelated deletes). Reconstruct the exact resource_id from
        // the soft-deleted row's lmt column (which `delByPk` writes to
        // the same DB-side timestamp it puts on the BaseTrash row),
        // then look up by resource_id directly.
        const lmtCol = model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );
        if (lmtCol) {
          const wherePk = await baseModel._wherePk(params.pk);
          const row = await baseModel
            .dbDriver(baseModel.getTnPath(model.table_name))
            .select(lmtCol.column_name)
            .where(wherePk)
            .first();
          const lmtValue = row?.[lmtCol.column_name];
          if (lmtValue) {
            const deletedAtIso = new Date(lmtValue).toISOString();
            const userId =
              (meta.originalReq?.user?.id as string | undefined) ??
              meta.createdBy ??
              null;
            const resourceId = buildRecordResourceId(
              params.modelId,
              userId,
              deletedAtIso,
            );
            const trashEntry = await BaseTrash.getByResourceId(
              context,
              'record',
              resourceId,
            );
            trashId = trashEntry?.id;
          }
        }
      } else {
        // No trash — hard-delete.
        const wherePk = await baseModel._wherePk(params.pk);
        await baseModel
          .dbDriver(baseModel.getTnPath(model.table_name))
          .where(wherePk)
          .del();
      }

      // Restore each displaced row. Each may live in a different
      // table — and even a different base or source, e.g. a cross-base
      // LTAR partner. Use the displaced model's own base_id so model
      // resolution and cache scoping are correct. Route through
      // `updateByPk` / `addLinks` so realtime + audit + webhooks fire
      // for the restored state — falls back to raw query if the
      // high-level call fails (e.g. column/col renamed mid-cycle).
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
          if (link) {
            try {
              await link.ownerBaseModel.addLinks({
                colId: link.colId,
                rowId: link.rowId,
                childIds: link.childIds,
                cookie: meta.originalReq,
              });
              continue;
            } catch (e: any) {
              // fall through to raw INSERT
            }
          }
          const mmModel = await Model.get(context, dr.mmModelId);
          if (!mmModel) continue;
          const mmContext = { ...context, base_id: mmModel.base_id };
          const mmSource = await Source.get(mmContext, mmModel.source_id);
          const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
            id: mmModel.id,
            dbDriver: await NcConnectionMgrv2.get(mmSource),
            source: mmSource,
          });
          await mmBaseModel
            .dbDriver(mmBaseModel.getTnPath(mmModel.table_name))
            .insert({
              [dr.parentMMCol]: dr.parentValue,
              [dr.childMMCol]: dr.childValue,
            });
        }
      }

      return trashId ? { metaUpdate: { trashId } } : undefined;
    },
  );
}
