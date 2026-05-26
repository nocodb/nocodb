import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import { syncSystemFieldsMap } from '@noco-local-integrations/core';
import type { ColumnType, NcContext } from 'nocodb-sdk';
import type Column from '~/models/Column';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type Model from '~/models/Model';
import { sanitizeColumnName } from '~/helpers/columnHelpers';

/** Source uidt → dest uidt remap. Anything not listed mirrors the source
 *  uidt directly. Also imported by `ColumnChangeTableSyncHandler` so a
 *  source type change propagates to the same dest type the user would
 *  have got at create time. */
export const REMAP_UIDTS: Partial<Record<string, UITypes>> = {
  [UITypes.Formula]: UITypes.SingleLineText,
  [UITypes.Lookup]: UITypes.LongText,
  [UITypes.Rollup]: UITypes.SingleLineText,
  [UITypes.User]: UITypes.SingleLineText,
  [UITypes.CreatedBy]: UITypes.SingleLineText,
  [UITypes.LastModifiedBy]: UITypes.SingleLineText,
  [UITypes.CreatedTime]: UITypes.DateTime,
  [UITypes.LastModifiedTime]: UITypes.DateTime,
};

export interface DestColumnDef {
  title: string;
  column_name: string;
  uidt: UITypes;
  readonly: boolean;
  pv?: boolean;
  colOptions?: { options: { title: string }[] };
}

export function toDestColumnDef(col: ColumnType): DestColumnDef {
  const def: DestColumnDef = {
    title: col.title!,
    column_name: col.column_name ?? sanitizeColumnName(col.title!),
    uidt: (REMAP_UIDTS[col.uidt!] ?? col.uidt) as UITypes,
    readonly: true,
  };
  if (col.pv) def.pv = true;
  const options = (
    col.colOptions as { options?: { title?: string }[] } | undefined
  )?.options;
  if (Array.isArray(options)) {
    def.colOptions = {
      options: options
        .filter((o): o is { title: string } => !!o.title)
        .map((o) => ({ title: o.title })),
    };
  }
  return def;
}

export function extractShareUuid(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (/^[a-z0-9-]{8,}$/i.test(trimmed) && !trimmed.includes('/')) {
    return trimmed;
  }
  const m = trimmed.match(/\/nc\/view\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

export const SYSTEM_REMOTE_TITLES = new Set(Object.keys(syncSystemFieldsMap));

export interface SyncRunMeta {
  syncId: string;
  runId: string;
  syncedAtIso: string;
  namespace: string;
}

interface LtarPlan {
  /** Title of the source LTAR column (matches the dest LTAR title). */
  sourceTitle: string;
  /** Junction (MM) table id on the destination. */
  mmModelId: string;
  /** Junction column TITLE for the parent side (linked shadow). V2 dataList /
   *  dataInsert key rows by title, not column_name. */
  mmParentColumnTitle: string;
  /** Junction column TITLE for the child side (this row's table). */
  mmChildColumnTitle: string;
  /** Junction column id for the child side — used to filter junction rows
   *  by main-row id when wiping stale links before re-inserting. */
  mmChildColumnId: string;
  /** PK column title on the linked (parent-side) table. */
  parentPkTitle: string;
  /** Destination table id of the linked-shadow this LTAR references.
   *  Lets the write helpers locate the matching LinkedShadow mapping when
   *  ensuring display-only stubs for referenced-but-filtered-out rows. */
  destLinkedTableId: string;
}

/** One source ↔ dest column pairing for the main forward-write loop.
 *  Decoupled source/dest titles so a source-side rename keeps the sync
 *  working — the source's current title is used to *read* from source
 *  rows, while the dest title (frozen at create time) is used to *write*
 *  into the dest row. */
export interface ForwardField {
  /** Title to read from on the source row (= sourceCol.title now). */
  sourceTitle: string;
  /** Title to write to on the dest row (= destCol.title, frozen). */
  destTitle: string;
  /** When set, value is array/object-shaped and gets flattened via
   *  `stringifyForJoin`. Resolved by `resolveDisplayTitle` exactly as the
   *  legacy `joinAsTextTitles` map did. `null` here means "no display
   *  titles known — render objects as ''". */
  displayTitles?: string[] | null;
}

export interface ColumnPlan {
  /** Source title for the order column, mirrored to the same-named dest
   *  col. Both sides use the same canonical title (`nc_order`), so
   *  decoupling source/dest isn't needed here. */
  orderTitle: string | null;
  /** One entry per (sourceCol, destCol) pair we'll forward on every row.
   *  Replaces the old `forwardTitles` set + `joinAsTextTitles` map; both
   *  used dest titles for both read and write, which broke on source rename. */
  forwardFields: ForwardField[];
  /** Source title whose value lifts onto RemoteCreatedAt, or null. */
  createdAtTitle: string | null;
  /** Source title whose value lifts onto RemoteUpdatedAt, or null. */
  updatedAtTitle: string | null;
  /** Source PK column title — used to extract the row's id from V2-flat
   *  source rows where the PK is keyed by title (e.g. "RowId" instead of "Id"). */
  sourcePkTitle: string;
  /** One entry per LTAR column on the destination main table. */
  linkPlans: LtarPlan[];
}

export async function buildColumnPlan(
  destContext: NcContext,
  destModel: Model,
  sourceContext: NcContext,
  sourceModel: Model,
  /** Column-mappings for this (Main or LinkedShadow) table-mapping — the
   *  id-keyed source ↔ dest pairing that survives source rename. Read by
   *  `TableSyncColumnMapping.listByTableSyncMapping` in the processor before
   *  this is called. */
  columnMappings: Array<{
    source_column_id: string;
    dest_column_id: string;
  }>,
): Promise<ColumnPlan> {
  const sourceColById = new Map<string, Column>();
  let createdAtTitle: string | null = null;
  let updatedAtTitle: string | null = null;
  let sourceOrderTitle: string | null = null;
  for (const c of sourceModel.columns ?? []) {
    if (c.id) sourceColById.set(c.id, c);
    if (!c.title) continue;
    if (c.uidt === UITypes.CreatedTime) createdAtTitle = c.title;
    if (c.uidt === UITypes.LastModifiedTime) updatedAtTitle = c.title;
    if (c.uidt === UITypes.Order) sourceOrderTitle = c.title;
  }

  const destColById = new Map<string, Column>();
  for (const c of destModel.columns ?? []) {
    if (c.id) destColById.set(c.id, c as Column);
  }

  const destHasOrder = (destModel.columns ?? []).some(
    (c) => c.uidt === UITypes.Order,
  );
  const orderTitle = destHasOrder ? sourceOrderTitle : null;

  const forwardFields: ForwardField[] = [];
  const linkPlans: LtarPlan[] = [];

  for (const cm of columnMappings) {
    const sourceCol = sourceColById.get(cm.source_column_id);
    const destCol = destColById.get(cm.dest_column_id);
    if (!sourceCol || !destCol) continue;
    if (!sourceCol.title || !destCol.title) continue;
    if (
      destCol.uidt === UITypes.CreatedTime ||
      destCol.uidt === UITypes.LastModifiedTime ||
      destCol.uidt === UITypes.CreatedBy ||
      destCol.uidt === UITypes.LastModifiedBy
    ) {
      continue;
    }

    // Real relations on the dest can't be written as field values — they
    // get rebuilt via junction-row writes after the main upsert.
    if (isLinksOrLTAR(destCol)) {
      if (!isLinksOrLTAR(sourceCol)) continue;

      const colOptions = (await destCol.getColOptions(destContext)) as
        | LinkToAnotherRecordColumn
        | undefined;
      if (!colOptions?.fk_mm_model_id || !colOptions?.fk_related_model_id) {
        continue;
      }

      const mmParentCol = await colOptions.getMMParentColumn(destContext);
      const mmChildCol = await colOptions.getMMChildColumn(destContext);
      if (!mmParentCol?.title || !mmChildCol?.title || !mmChildCol?.id) {
        continue;
      }

      let parentPkTitle = 'Id';
      try {
        const relatedTable = await colOptions.getRelatedTable(destContext);
        if (relatedTable) {
          await relatedTable.getColumns(destContext);
          parentPkTitle =
            (relatedTable.columns ?? []).find((c) => c.pk)?.title ?? 'Id';
        }
      } catch {
        // fall back to 'Id'
      }

      linkPlans.push({
        // Read junction values from the source row at its CURRENT title.
        sourceTitle: sourceCol.title,
        mmModelId: colOptions.fk_mm_model_id,
        mmParentColumnTitle: mmParentCol.title,
        mmChildColumnTitle: mmChildCol.title,
        mmChildColumnId: mmChildCol.id,
        parentPkTitle,
        destLinkedTableId: colOptions.fk_related_model_id,
      });
      continue;
    }

    const srcCol = sourceCol;

    // Source-side array- or object-shaped types → flatten to text on write.
    // The "display titles" are ordered candidate field names on each item;
    // the first one resolving to a primitive value wins. Resolved
    // deterministically per source uidt:
    //   - LTAR        → [related table's `pv: true` column title].
    //   - Lookup      → walk relation column → related table → lookup column;
    //                   if that lookup column is itself LTAR, resolve ITS
    //                   related table's pv title. If it's a primitive uidt,
    //                   no display title is needed (items come back as
    //                   primitives and short-circuit in `stringifyForJoin`).
    //   - User /
    //     CreatedBy /
    //     LastModifiedBy → ['display_name', 'email'] (V2 user payload shape;
    //                      dest column is remapped to SingleLineText at
    //                      table creation — see `toDestColumnDef` above).
    //   - Links       → counter integer (no objects to render); display
    //                   title stays null.
    // null is intentional — `stringifyForJoin` returns '' for any object
    // without a resolved display title rather than guessing.
    let displayTitles: string[] | null | undefined;
    if (
      srcCol.uidt === UITypes.Lookup ||
      srcCol.uidt === UITypes.Links ||
      srcCol.uidt === UITypes.LinkToAnotherRecord ||
      srcCol.uidt === UITypes.User ||
      srcCol.uidt === UITypes.CreatedBy ||
      srcCol.uidt === UITypes.LastModifiedBy
    ) {
      displayTitles = await resolveDisplayTitle(srcCol, sourceContext);
    }

    forwardFields.push({
      sourceTitle: sourceCol.title,
      destTitle: destCol.title,
      ...(displayTitles !== undefined ? { displayTitles } : {}),
    });
  }

  const sourcePkTitle =
    (sourceModel.columns ?? []).find((c) => c.pk)?.title ?? 'Id';

  return {
    orderTitle,
    forwardFields,
    createdAtTitle,
    updatedAtTitle,
    sourcePkTitle,
    linkPlans,
  };
}

const USER_DISPLAY_TITLES = ['display_name', 'email'];

async function resolveDisplayTitle(
  srcCol: Column,
  sourceContext: NcContext,
): Promise<string[] | null> {
  try {
    if (srcCol.uidt === UITypes.LinkToAnotherRecord) {
      const opts = (await srcCol.getColOptions(sourceContext)) as
        | LinkToAnotherRecordColumn
        | undefined;
      const related = await opts?.getRelatedTable(sourceContext);
      if (!related) return null;
      await related.getColumns(sourceContext);
      const pv = (related.columns ?? []).find((c) => c.pv)?.title;
      return pv ? [pv] : null;
    }

    if (srcCol.uidt === UITypes.Lookup) {
      const opts = (await srcCol.getColOptions(sourceContext)) as
        | LookupColumn
        | undefined;
      if (!opts?.fk_relation_column_id || !opts?.fk_lookup_column_id) {
        return null;
      }

      const relationCol = await opts.getRelationColumn(sourceContext);
      const relationOpts = (await relationCol?.getColOptions(sourceContext)) as
        | LinkToAnotherRecordColumn
        | undefined;
      const targetTable = await relationOpts?.getRelatedTable(sourceContext);
      if (!targetTable) return null;
      await targetTable.getColumns(sourceContext);

      const lookupCol = await opts.getLookupColumn(sourceContext);
      if (!lookupCol) return null;

      // Lookup of LTAR: items come back as objects from the inner related
      // table — resolve THAT table's pv title.
      if (lookupCol.uidt === UITypes.LinkToAnotherRecord) {
        const deeperOpts = (await lookupCol.getColOptions(sourceContext)) as
          | LinkToAnotherRecordColumn
          | undefined;
        const deeperTable = await deeperOpts?.getRelatedTable(sourceContext);
        if (!deeperTable) return null;
        await deeperTable.getColumns(sourceContext);
        const pv = (deeperTable.columns ?? []).find((c) => c.pv)?.title;
        return pv ? [pv] : null;
      }

      // Lookup of a User-typed column — items have the fixed user payload shape.
      if (
        lookupCol.uidt === UITypes.User ||
        lookupCol.uidt === UITypes.CreatedBy ||
        lookupCol.uidt === UITypes.LastModifiedBy
      ) {
        return USER_DISPLAY_TITLES;
      }

      // Lookup of a primitive uidt — items will be primitives, no display
      // title needed.
      return null;
    }

    if (
      srcCol.uidt === UITypes.User ||
      srcCol.uidt === UITypes.CreatedBy ||
      srcCol.uidt === UITypes.LastModifiedBy
    ) {
      return USER_DISPLAY_TITLES;
    }
  } catch {
    return null;
  }

  return null;
}

/** V2 flat rows key the PK by its column title. Treats empty string as
 *  missing — V2 shouldn't return "" for a PK, but be defensive. */
export function extractSourcePk(
  row: Record<string, any>,
  pkTitle: string,
): string | null {
  const v = row?.[pkTitle];
  if (v == null || v === '') return null;
  return String(v);
}

/** Normalize an LTAR field value from a V2 flat row into a deduped list of
 *  linked source-row ids. V2 LTAR values look like
 *  `[{<parentPkTitle>: <id>, <pv>: ...}]` — also tolerates inline primitive ids. */
export function normalizeLinkValue(
  value: unknown,
  parentPkTitle = 'Id',
): string[] {
  if (value == null) return [];
  const entries = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  for (const e of entries) {
    if (e == null) continue;
    if (
      typeof e === 'string' ||
      typeof e === 'number' ||
      typeof e === 'bigint'
    ) {
      const s = String(e);
      if (s !== '') seen.add(s);
      continue;
    }
    if (typeof e !== 'object') continue;
    const obj = e as Record<string, any>;
    const id =
      obj[parentPkTitle] ??
      (parentPkTitle !== 'Id' ? obj.Id : undefined) ??
      obj.id;
    if (id == null || id === '') continue;
    seen.add(String(id));
  }
  return Array.from(seen);
}

/** Flatten an array- or object-shaped source value to comma-separated text
 *  using ordered `displayTitles` candidates. Primitive/null `v` passes
 *  through unchanged. Inside arrays:
 *   - primitive items → `String(item)`
 *   - object items   → first `displayTitles` field whose value is a
 *     primitive; unresolved objects are skipped (so mixed arrays render
 *     as `"a, b"` rather than `"a, , b"`).
 *  `displayTitles === null` is intentional — caller couldn't resolve a
 *  display title, so every object is unresolvable and the result for an
 *  all-object input is `''`. */
function stringifyForJoin(v: any, displayTitles: string[] | null): any {
  const items = Array.isArray(v)
    ? v
    : v != null && typeof v === 'object'
    ? [v]
    : null;
  if (!items) return v;

  const parts: string[] = [];
  for (const item of items) {
    if (item == null) continue;
    if (typeof item !== 'object') {
      parts.push(String(item));
      continue;
    }
    if (!displayTitles) continue;
    for (const title of displayTitles) {
      const itemVal = item[title];
      if (
        itemVal != null &&
        (typeof itemVal === 'string' ||
          typeof itemVal === 'number' ||
          typeof itemVal === 'boolean')
      ) {
        parts.push(String(itemVal));
        break;
      }
    }
  }
  return parts.join(', ');
}

/** Shape a V2 source row into the destination's column space.
 *
 * Array- or object-shaped source values (LTAR, Lookup, User, CreatedBy,
 * LastModifiedBy) flatten to comma-separated text. Items are rendered as:
 *   - primitives → `String(item)` directly
 *   - objects → first `displayTitles` field whose value is a primitive;
 *     `''` if none resolve. No guessing — user gets a predictable empty
 *     cell rather than the wrong field.
 */
export function toDestRow(
  row: Record<string, any>,
  plan: ColumnPlan,
  sourceId: string,
  runMeta: SyncRunMeta,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of plan.forwardFields) {
    if (!(field.sourceTitle in row)) continue;
    const raw = row[field.sourceTitle];
    out[field.destTitle] =
      field.displayTitles !== undefined
        ? stringifyForJoin(raw, field.displayTitles)
        : raw;
  }

  if (plan.orderTitle && plan.orderTitle in row) {
    const orderVal = row[plan.orderTitle];
    if (orderVal != null && orderVal !== '') {
      out[plan.orderTitle] = orderVal;
    }
  }

  return {
    ...out,
    ...buildSyncSystemFields({
      sourceId,
      record: row,
      createdAt: plan.createdAtTitle ? row[plan.createdAtTitle] : null,
      updatedAt: plan.updatedAtTitle ? row[plan.updatedAtTitle] : null,
      runMeta,
    }),
  };
}

export function buildSyncSystemFields(opts: {
  sourceId: string;
  record: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  runMeta: SyncRunMeta;
  deleted?: boolean;
  deletedAt?: string | null;
}): Record<string, unknown> {
  return {
    RemoteId: opts.sourceId,
    RemoteRaw: JSON.stringify(opts.record),
    RemoteCreatedAt: opts.createdAt ?? null,
    RemoteUpdatedAt: opts.updatedAt ?? null,
    RemoteDeletedTime: opts.deletedAt ?? null,
    RemoteDeleted: opts.deleted ?? false,
    RemoteSyncedAt: opts.runMeta.syncedAtIso,
    RemoteNamespace: opts.runMeta.namespace,
    SyncConfigId: opts.runMeta.syncId,
    SyncRunId: opts.runMeta.runId,
    SyncProvider: 'nocodb-table-sync',
  };
}
