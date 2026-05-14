import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { RelationTypes } from 'nocodb-sdk';
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isVirtualCol,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  CaptureBag,
  CaptureKey,
  DisplacedRecord,
  LinkChange,
  ScopeRef,
} from '~/command-registry/types';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import { scopeTable } from '~/command-registry/scope';
import { Base, Column as ColumnModel, Model, Source } from '~/models';
import { dataWrapper, splitCompositePkString } from '~/helpers/dbHelpers';
import {
  captureForTrace,
  getTraceCapture,
} from '~/decorators/trace-command.decorator';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

function withBaseId(context: NcContext, baseId?: string): NcContext {
  return baseId ? { ...context, base_id: baseId } : context;
}

export const logger = new Logger('record.operations');

export type ReplaySkipReason =
  | 'column_missing'
  | 'model_missing'
  | 'junction_column_missing';

export interface ReplaySkip {
  reason: ReplaySkipReason;
  ref: string;
}

/**
 * Forward-params shape for `recordInsert`. Loose-typed because v1 and
 * v2 paths share this contract; per-shape validation happens at the
 * service layer. Inline here because it isn't reused from `_schemas`.
 */
export const recordInsertSchema = z
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

export interface RecordInsertExtra {
  modelId: string;
  primaryKeyTitles: string[];
}

export interface RecordDeleteExtra {
  modelId: string;
  primaryKeyTitles: string[];
  parentEntityTitle: string;
}

export interface RecordUpdateExtra {
  modelId: string;
  primaryKeyTitles: string[];
  parentEntityTitle: string;
}

export interface RecordBulkUpsertExtra {
  modelId: string;
  primaryKeyTitles: string[];
  parentEntityTitle: string;
}

export interface RecordLinkExtra {
  modelId: string;
  parentEntityTitle: string;
}

export interface RecordMoveExtra {
  modelId: string;
  parentEntityTitle: string;
}

export interface RecordLinkSwapExtra {
  modelId: string;
  parentEntityTitle: string;
}

/** Forward params seen by record-operation helpers. Loose-typed because
 *  the seven record contracts have different schemas (v1/v2 shapes) and
 *  these helpers serve all of them. */
export type RecordParams = Record<string, any>;

/** Resolve modelId from either v2-shape (`params.modelId`) or v1-shape
 *  (`params.baseName` + `params.tableName`) params. */
export async function resolveModelIdFromParams(
  context: NcContext,
  params: RecordParams,
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

/** Safe pk extraction: returns `undefined` for missing/`N/A`. Centralizes
 *  the `dataWrapper(row).extractPksValue(model, true)` boilerplate so
 *  callers can branch on a single string-or-undefined. */
export function extractRowPk(
  row: Record<string, any>,
  model: Model,
): string | undefined {
  const v = dataWrapper(row).extractPksValue(model, true);
  return v == null || v === 'N/A' ? undefined : String(v);
}

/** Pull the row pk out of a delete/update forward params object.
 *  v1 path carries `rowId` already in joined form. v2/v3 path carries
 *  pk fields inside `body` (or `body[0]` if the bulk dispatcher routed
 *  a 1-element array here). */
export function extractRowPkFromParams(
  params: RecordParams,
  model: Model,
): string | undefined {
  if (params.rowId != null) return String(params.rowId);
  let body = params.body;
  if (Array.isArray(body)) body = body[0];
  if (!body || typeof body !== 'object') return undefined;
  return extractRowPk(body, model);
}

/** Build a pk → row map, skipping rows with no resolvable pk. */
export function indexRowsByPk(
  rows: ReadonlyArray<Record<string, any>>,
  model: Model,
): Map<string, Record<string, any>> {
  const byPk = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const pk = extractRowPk(r, model);
    if (pk) byPk.set(pk, r);
  }
  return byPk;
}

/** entity_id callback shared by `recordDelete` / `recordUpdate`. Pulls
 *  the row pk from `rowId` (v1) or `body`/`body[0]` (v2/v3) via the
 *  resolved primaryKeyTitles slot. */
export function entityIdFromRowOrBody(
  params: RecordParams,
  _result: unknown,
  resolved?: { extra?: { primaryKeyTitles?: string[] } },
): string | undefined {
  if (params.rowId != null) return String(params.rowId);
  let body = params.body;
  if (Array.isArray(body)) body = body[0];
  if (!body || typeof body !== 'object') return undefined;
  return pkFromRow(body, resolved?.extra);
}

/** Set of LTAR column keys (title + column_name + id) for fast lookup
 *  when stripping nested LTAR snapshots from an insert/update body. */
export function ltarKeysFromColumns(columns: Column[]): Set<string> {
  const out = new Set<string>();
  for (const c of columns) {
    if (isLinksOrLTAR(c)) {
      out.add(c.title);
      out.add(c.column_name);
      out.add(c.id);
    }
  }
  return out;
}

/** Sync composite-pk extraction for inverse-builder callbacks that
 *  don't have a Model in scope — works off the
 *  `recordModelContext.primaryKeyTitles` slot.
 *
 *  Single pk → returns the value as a string.
 *  Composite pk → joins values with `___` and escapes `_` → `\_` to
 *  match `extractPksValue(model, true)`. Returns `undefined` when any
 *  pk column is missing from `row`. */
export function pkFromRow(
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
 *  joined strings (`"a___b"`) split via `splitCompositePkString` and
 *  zipped with the model's pk titles in order. */
export function buildRowFromCompositePk(
  pk: string,
  model: { primaryKeys: ReadonlyArray<{ title: string }> },
): Record<string, string> {
  const pks = model.primaryKeys;
  if (pks.length === 1) return { [pks[0].title]: pk };
  const parts = splitCompositePkString(pk);
  const row: Record<string, string> = {};
  for (let i = 0; i < pks.length; i++) row[pks[i].title] = parts[i];
  return row;
}

/** Strip pk titles from the update body for use as the inverse-side
 *  `body` slot. The pk lives in `pk` already; the inverse-restore
 *  payload is purely the changed non-pk fields. */
export function stripPkTitles(
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

/** Detect a no-op update by inspecting the captured `recordPrev`.
 *  Changed-fields-only snapshots always include pk titles (so the row
 *  can be located on undo) — when there are NO non-pk keys in any
 *  snapshot, the update touched no real fields. Common case: FE sends
 *  `{Id: N}`-only bodies after an LTAR cell paste (the link mutation is
 *  recorded separately as `recordLinkByDisplay`/`recordLinkSwap`).
 *  Skipping here avoids phantom undo entries that would do nothing. */
export function isNoOpRecordPrev(
  primaryKeyTitles: ReadonlyArray<string> | undefined,
): boolean {
  const recordPrev = getTraceCapture('recordPrev') ?? [];
  if (!recordPrev.length) return true;
  const pkSet = new Set(primaryKeyTitles ?? []);
  return recordPrev.every((p) => {
    if (!p || typeof p !== 'object') return true;
    return Object.keys(p).every((k) => pkSet.has(k));
  });
}

/** Strip body fields the server controls. Auto-generated time/by columns
 *  are unconditionally rejected by `handleValidateBulkInsert`; virtual
 *  non-LTAR columns the same. Without this strip, redo of a recorded
 *  body fails with "Column auto generated and cannot be updated"
 *  because `prepareNocoData` mutated the body before the trace decorator
 *  captured it. */
export function stripServerControlledFields(
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

/** Invert a captured V3 LTAR diff entry: 'add' → removeLinks,
 *  'remove' → addLinks. Resolves the owner-side baseModel via the
 *  LTAR column's owning model (NOT necessarily the operation's primary
 *  modelId — the column may live on a related table when the body
 *  update touched a foreign-table LTAR field).
 *
 *  Returns a `ReplaySkip` when the LTAR column has been deleted since the
 *  forward op recorded the change; returns `null` on success. Callers
 *  should accumulate skips and let the dispatcher surface them as
 *  `partial` instead of aborting siblings in the loop. */
export async function invertLinkChange(
  context: NcContext,
  lc: LinkChange,
  originalReq: NcRequest,
): Promise<ReplaySkip | null> {
  const colCtx = withBaseId(context, lc.baseId);
  const col = await ColumnModel.get(colCtx, { colId: lc.colId });
  if (!col) {
    logger.warn(
      `invertLinkChange: column ${lc.colId} not found — skipping (likely deleted since forward op)`,
    );
    return { reason: 'column_missing', ref: lc.colId };
  }
  const ownerModel = await col.getModel(colCtx);
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
  return null;
}

export type JunctionLinkSides = {
  colId: string;
  rowId: string;
  childIds: (string | number)[];
  ownerBaseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>;
};

/** Map a captured V2 junction `DisplacedRecord` to the
 *  `(rowId, childIds)` shape `addLinks` / `removeLinks` expects. Returns
 *  a `ReplaySkip` when the junction column has been deleted since the
 *  forward op recorded the displacement — callers must check the
 *  discriminator and either continue the iteration or surface the skip. */
export async function resolveJunctionLinkSides(
  context: NcContext,
  dr: Extract<DisplacedRecord, { kind: 'junction' }>,
): Promise<
  { ok: true; sides: JunctionLinkSides } | { ok: false; skip: ReplaySkip }
> {
  const colCtx = withBaseId(context, dr.baseId);
  const col = await ColumnModel.get(colCtx, { colId: dr.colId });
  if (!col) {
    logger.warn(
      `resolveJunctionLinkSides: column ${dr.colId} not found — skipping junction restore`,
    );
    return {
      ok: false,
      skip: { reason: 'junction_column_missing', ref: dr.colId },
    };
  }
  const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(colCtx);
  const ownerModel = await col.getModel(colCtx);
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
    ok: true,
    sides: {
      colId: dr.colId,
      rowId: String(ownPk),
      childIds: [otherPk],
      ownerBaseModel,
    },
  };
}

/** Pick only the serializable link-shape fields from params for the
 *  inverse op. Spreading `...params` would carry `cookie: req` (Express
 *  request, circular refs) into `inverse_params` and break JSON
 *  serialization. */
export function pickLinkParams(params: RecordParams): Record<string, any> {
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

/** Same purpose as `pickLinkParams` for the link-swap contracts. */
export function pickLinkSwapParams(params: RecordParams): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of [
    'modelId',
    'baseId',
    'viewId',
    'columnId',
    'rowId',
    'link',
    'unlink',
    'entries',
  ]) {
    if (params[k] !== undefined) out[k] = params[k];
  }
  return out;
}

/** Build a `BaseModelSqlv2` for a given model in the current context. */
export async function getBaseModelForModel(
  context: NcContext,
  model: Pick<Model, 'id' | 'source_id'>,
): Promise<Awaited<ReturnType<typeof Model.getBaseModelSQL>>> {
  const source = await Source.get(context, model.source_id);
  return await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: await NcConnectionMgrv2.get(source),
    source,
  });
}

interface RecordModelContext {
  modelId: string;
  primaryKeyTitles: string[];
}

/** Resolve the model + capture recordModelContext for an `entry.before`.
 *  Returns `undefined` when the model can't be resolved — caller should
 *  short-circuit with `return {}`. */
export async function resolveModelForEntry(
  context: NcContext,
  params: RecordParams,
  opts: { fallbackToParamsModelId?: boolean } = {},
): Promise<{ model: Model; ctx: RecordModelContext } | undefined> {
  const modelId = opts.fallbackToParamsModelId
    ? params.modelId ?? (await resolveModelIdFromParams(context, params))
    : await resolveModelIdFromParams(context, params);
  if (!modelId) return undefined;
  const model = await Model.get(context, modelId);
  if (!model) return undefined;
  await model.getColumns(context);
  const ctx: RecordModelContext = {
    modelId,
    primaryKeyTitles: (model.primaryKeys ?? []).map((c) => c.title),
  };
  captureForTrace('recordModelContext', ctx);
  return { model, ctx };
}

interface ReplayHandlerMeta {
  extra?: { recordModelContext?: RecordModelContext } & Record<string, unknown>;
}

/** Resolve the model for a replay handler. Walks the fallback chain
 *  `meta.extra.recordModelContext → params.modelId → resolveModelIdFromParams`
 *  and throws a labelled error when none works. */
export async function resolveReplayModel(
  context: NcContext,
  params: RecordParams,
  meta: ReplayHandlerMeta,
  opName: string,
): Promise<{
  modelId: string;
  model: Model;
  persistedCtx: RecordModelContext | undefined;
}> {
  const persistedCtx = meta.extra?.recordModelContext;
  const modelId =
    persistedCtx?.modelId ??
    params.modelId ??
    (await resolveModelIdFromParams(context, params));
  if (!modelId) {
    throw new Error(`${opName} replay: could not resolve modelId`);
  }
  const model = await Model.get(context, modelId);
  if (!model) {
    throw new Error(`${opName} replay: model ${modelId} not found`);
  }
  await model.getColumns(context);
  return { modelId, model, persistedCtx };
}

export const scopeRecordOp = (
  params: unknown,
  _result: unknown,
  resolved: { extra?: { modelId?: string } } | undefined,
): ScopeRef => {
  const p = params as RecordParams | undefined;
  return scopeTable(
    ((p?.modelId as string | undefined) ?? resolved?.extra?.modelId)!,
  );
};

export async function linkSwapBefore(context: NcContext, params: RecordParams) {
  const modelId =
    params.modelId ?? (await resolveModelIdFromParams(context, params));
  if (!modelId) return {};
  const model = await Model.get(context, modelId);
  if (!model) return {};
  return {
    parentEntityTitle: model.title,
    extra: { modelId, parentEntityTitle: model.title ?? '' },
  };
}

/** Replays `displacedRecords` forward — re-applies the FK / junction
 *  mutations the original insert performed, so trash-restore's
 *  link-conflict detector sees the same world the forward op did. Used
 *  by `recordInsert`/`recordBulkInsert` redo on the trashId branch.
 *
 *  Returns the list of per-entry skips (missing model / missing junction
 *  column). Sibling entries continue to run — partial reapply is better
 *  than aborting after a few entries already wrote. */
export async function reapplyDisplacedForward(
  context: NcContext,
  displaced: ReadonlyArray<DisplacedRecord>,
  originalReq: NcRequest,
): Promise<ReadonlyArray<ReplaySkip>> {
  const skips: ReplaySkip[] = [];
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
      const drCtx = withBaseId(context, dr.baseId);
      const drModel = await Model.get(drCtx, dr.modelId);
      if (!drModel) {
        logger.warn(
          `reapplyDisplacedForward: model ${dr.modelId} not found — skipping displaced row pk=${dr.pk}`,
        );
        skips.push({ reason: 'model_missing', ref: dr.modelId });
        continue;
      }
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
          originalReq,
        );
      } catch {
        const drWherePk = await drBaseModel._wherePk(dr.pk);
        await drBaseModel
          .dbDriver(drBaseModel.getTnPath(drModel.table_name))
          .update({ [dr.column]: next })
          .where(drWherePk);
      }
    } else if (dr.kind === 'junction') {
      const linkRes = await resolveJunctionLinkSides(context, dr);
      if ('skip' in linkRes) {
        skips.push(linkRes.skip);
        continue;
      }
      await linkRes.sides.ownerBaseModel.removeLinks({
        colId: linkRes.sides.colId,
        rowId: linkRes.sides.rowId,
        childIds: linkRes.sides.childIds,
        cookie: originalReq,
      });
    }
  }
  return skips;
}

/** Pick the freshest single-row prev snapshot for an undo handler.
 *  Prefers `meta.extra.recordPrev` (rotated by latest redo) over the
 *  frozen `params.prev`. Matches by composite-pk; falls back to the
 *  first entry when no match is found. */
export function pickFreshestPrev(
  meta: ReplayHandlerMeta & {
    extra?: { recordPrev?: ReadonlyArray<Record<string, unknown>> };
  },
  params: { pk?: string | number; prev?: Record<string, unknown> },
  model: Model,
): Record<string, any> {
  const extraPrevList = meta.extra?.recordPrev;
  if (!extraPrevList?.length) return (params.prev ?? {}) as Record<string, any>;
  const targetPk = String(params.pk);
  const match = extraPrevList.find((r) => extractRowPk(r, model) === targetPk);
  return (match ?? extraPrevList[0]) as Record<string, any>;
}

/** Bulk variant of `pickFreshestPrev`. For each `params.rows[i].pk`,
 *  prefers the matching entry from `meta.extra.recordPrev`; falls back
 *  to the frozen `params.rows[i].prev`. */
export function pickFreshestRows(
  meta: ReplayHandlerMeta & {
    extra?: { recordPrev?: ReadonlyArray<Record<string, unknown>> };
  },
  params: {
    rows?: ReadonlyArray<{
      pk?: string | number;
      prev?: Record<string, unknown>;
    }>;
  },
  model: Model,
): ReadonlyArray<{ pk: string | number; prev: Record<string, any> }> {
  const rows = params.rows ?? [];
  const extraPrevList = meta.extra?.recordPrev;
  if (!extraPrevList?.length) {
    return rows.map((r) => ({
      pk: r.pk as string | number,
      prev: (r.prev ?? {}) as Record<string, any>,
    }));
  }
  const byPk = indexRowsByPk(extraPrevList, model);
  return rows.map((r) => ({
    pk: r.pk as string | number,
    prev: (byPk.get(String(r.pk)) ?? r.prev ?? {}) as Record<string, any>,
  }));
}

/** Read a rotated slot off `meta.extra`, falling back to the frozen
 *  same-named slot on `params`, then to `[]`. Used for
 *  `displacedRecords` / `linkChanges` in undo handlers. */
export function pickFreshestList<T>(
  meta: { extra?: Record<string, unknown> },
  params: Record<string, unknown>,
  key: string,
): ReadonlyArray<T> {
  return (meta.extra?.[key] ?? params[key] ?? []) as ReadonlyArray<T>;
}

/** Harvest the named capture-bag keys into a metaUpdate object. Returns
 *  `undefined` when nothing fresh was captured (so the handler can
 *  short-circuit). Used by redo handlers to rotate fresh snapshots
 *  forward for the next undo cycle. */
export function buildRedoMetaUpdate<K extends CaptureKey>(
  bag: Map<CaptureKey, CaptureBag[CaptureKey]>,
  keys: ReadonlyArray<K>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = bag.get(key);
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? [...value] : value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Restores `displacedRecords` to their pre-mutation state — reverses
 *  what `reapplyDisplacedForward` does. Used by all undo handlers.
 *
 *  Returns the list of per-entry skips so the handler can surface them
 *  as a partial-undo signal rather than reporting full success. */
export async function restoreDisplaced(
  context: NcContext,
  displaced: ReadonlyArray<DisplacedRecord>,
  originalReq: NcRequest,
): Promise<ReadonlyArray<ReplaySkip>> {
  const skips: ReplaySkip[] = [];
  for (const dr of displaced) {
    if (dr.kind === 'column') {
      const drCtx = withBaseId(context, dr.baseId);
      const drModel = await Model.get(drCtx, dr.modelId);
      if (!drModel) {
        logger.warn(
          `restoreDisplaced: model ${dr.modelId} not found — skipping displaced row pk=${dr.pk}`,
        );
        skips.push({ reason: 'model_missing', ref: dr.modelId });
        continue;
      }
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
          originalReq,
        );
      } catch {
        const drWherePk = await drBaseModel._wherePk(dr.pk);
        await drBaseModel
          .dbDriver(drBaseModel.getTnPath(drModel.table_name))
          .update({ [dr.column]: dr.prev })
          .where(drWherePk);
      }
    } else if (dr.kind === 'junction') {
      const linkRes = await resolveJunctionLinkSides(context, dr);
      if ('skip' in linkRes) {
        skips.push(linkRes.skip);
        continue;
      }
      await linkRes.sides.ownerBaseModel.addLinks({
        colId: linkRes.sides.colId,
        rowId: linkRes.sides.rowId,
        childIds: linkRes.sides.childIds,
        cookie: originalReq,
      });
    }
  }
  return skips;
}

/**
 * Bulk-delete with per-row fallback. Wraps the
 *   try { bulkDelete } catch { for-pk-in-pks { try { delByPk } catch {} } }
 * shape used by `recordBulkDelete` (forward), `recordBulkInsertUndo`, and
 * `recordBulkUpsertUndo`.
 */
export async function bulkDeleteWithPerRowFallback(opts: {
  baseModel: BaseModelSqlv2;
  rows: ReadonlyArray<Record<string, unknown>>;
  pks: ReadonlyArray<string | number>;
  cookie: NcRequest;
  opName: string;
}): Promise<{ failedPks: string[] }> {
  const failedPks: string[] = [];
  try {
    await opts.baseModel.bulkDelete(opts.rows as Record<string, unknown>[], {
      cookie: opts.cookie,
    });
    return { failedPks };
  } catch (bulkErr: unknown) {
    const msg = bulkErr instanceof Error ? bulkErr.message : String(bulkErr);
    logger.warn(
      `${opts.opName} bulkDelete failed; falling back to per-row delete: ${msg}`,
    );
  }
  for (const pk of opts.pks) {
    try {
      await opts.baseModel.delByPk(String(pk), null, opts.cookie);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failedPks.push(String(pk));
      logger.warn(`${opts.opName} per-row delete failed for pk=${pk}: ${msg}`);
    }
  }
  return { failedPks };
}
