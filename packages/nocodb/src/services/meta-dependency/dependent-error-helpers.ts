import { Logger } from '@nestjs/common';
import {
  ButtonActionsType,
  EventType,
  formulaJsep,
  getAvailableRollupForUiType,
  isLinksOrLTAR,
  isRollupAggregatableColumn,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { LinkToAnotherRecordColumn } from '~/models';
import Noco from '~/Noco';
import Column from '~/models/Column';
import Model from '~/models/Model';
import { MetaTable } from '~/utils/globals';
import {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
  Source,
} from '~/models';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import { invalidateSingleQueryCacheForModels } from '~/helpers/metaCacheInvalidator';
import { getRelatedModelMap } from '~/utils/getRelatedModelMap';
import NocoSocket from '~/socket/NocoSocket';

const logger = new Logger('DependentErrorHelpers');

export interface Dependent {
  id: string;
  type: string;
  // Base the dependent column lives in; omitted = the trashed item's base.
  base_id?: string;
}

export interface ClearOptions {
  // Re-run the formula check before clearing a formula/button error.
  revalidateFormulas?: boolean;
}

// Column types whose `error` is set by the column-delete cascade.
const CASCADE_ERROR_UIDTS = new Set<string>([
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.QrCode,
  UITypes.Barcode,
]);

const dependentKey = (d: Pick<Dependent, 'id' | 'base_id'>) =>
  `${d.base_id ?? ''}:${d.id}`;

/** Append `items` to `target`, skipping entries already present. */
export function addDependents(target: Dependent[], items: Dependent[]) {
  const seen = new Set(target.map(dependentKey));
  for (const item of items) {
    const key = dependentKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(item);
  }
}

const dependentContext = (
  ctx: NcContext,
  dep: Pick<Dependent, 'base_id'>,
): NcContext =>
  dep.base_id && dep.base_id !== ctx.base_id
    ? { ...ctx, base_id: dep.base_id }
    : ctx;

/**
 * Clear the `error` on each recorded dependent once nothing it references is
 * still trashed or itself in error. Runs in passes until no more clear, so a
 * lookup-of-a-lookup clears after the lookup it reads from, whatever the
 * recorded order.
 *
 * `skipBroadcastModelIds`: tables the caller already broadcasts itself.
 */
export async function clearDependentErrorsIfResolved(
  ctx: NcContext,
  dependents: Dependent[],
  ncMeta: MetaService = Noco.ncMeta,
  skipBroadcastModelIds: string[] = [],
  options: ClearOptions = {},
): Promise<void> {
  const pending: Dependent[] = [];
  addDependents(pending, dependents);

  const affectedModels: AffectedModels = new Map();

  let progressed = true;
  while (pending.length && progressed) {
    progressed = false;
    for (let i = 0; i < pending.length; ) {
      const dep = pending[i];
      const depCtx = dependentContext(ctx, dep);
      // A trashed dependent still gets its error cleared, so it comes back clean.
      const col = await Column.get(
        depCtx,
        { colId: dep.id, includeDeleted: true },
        ncMeta,
      );
      if (!col) {
        pending.splice(i, 1);
        continue;
      }
      if (await dependentStillBroken(depCtx, dep, col, ncMeta)) {
        i++;
        continue;
      }
      let parsedTree: unknown;
      if (
        options.revalidateFormulas &&
        (dep.type === 'formula' || dep.type === 'button')
      ) {
        parsedTree = await revalidateFormulaDependent(depCtx, col, ncMeta);
        if (!parsedTree) {
          i++;
          continue;
        }
      }
      await clearDependentError(depCtx, dep, col, ncMeta, parsedTree);
      affectedModels.set(`${depCtx.base_id}:${col.fk_model_id}`, {
        ctx: depCtx,
        modelId: col.fk_model_id,
      });
      pending.splice(i, 1);
      progressed = true;
    }
  }

  await refreshAffectedModels(affectedModels, ncMeta, skipBroadcastModelIds);
}

type AffectedModels = Map<string, { ctx: NcContext; modelId: string }>;

/** Drop the single-query cache of each model, then broadcast a column_update. */
async function refreshAffectedModels(
  affectedModels: AffectedModels,
  ncMeta: MetaService,
  skipBroadcastModelIds: string[],
) {
  for (const { ctx: modelCtx, modelId } of affectedModels.values()) {
    await invalidateSingleQueryCacheForModels(modelCtx, [modelId], ncMeta);
  }

  const toBroadcast = [...affectedModels.values()].filter(
    ({ modelId }) => !skipBroadcastModelIds.includes(modelId),
  );
  // Fire-and-forget outside the trx, like the mark side: a broadcast
  // failure must not roll back the restore.
  broadcastColumnUpdates(toBroadcast).catch((e) =>
    logger.error(
      `Failed to broadcast column_update events: ${e?.message}`,
      e?.stack,
    ),
  );
}

async function clearDependentError(
  ctx: NcContext,
  dep: Dependent,
  col: Column,
  ncMeta: MetaService,
  parsedTree?: unknown,
) {
  // Only set when the formula was revalidated; otherwise the stored tree stays.
  const tree = parsedTree ? { parsed_tree: parsedTree } : {};
  switch (dep.type) {
    case 'lookup':
      await LookupColumn.update(ctx, dep.id, { error: null }, ncMeta);
      break;
    case 'rollup':
      await RollupColumn.update(ctx, dep.id, { error: null }, ncMeta);
      break;
    case 'qrcode':
      await QrCodeColumn.update(ctx, dep.id, { error: null }, ncMeta);
      break;
    case 'barcode':
      await BarcodeColumn.update(ctx, dep.id, { error: null }, ncMeta);
      break;
    case 'formula':
      await FormulaColumn.update(ctx, dep.id, { error: null, ...tree }, ncMeta);
      break;
    case 'button': {
      // ButtonColumn.update filters props by `type`; without it `error` is
      // dropped and the clear silently no-ops.
      const buttonOpt = await col.getColOptions<ButtonColumn>(ncMeta);
      const buttonType = buttonOpt?.type ?? ButtonActionsType.Url;
      await ButtonColumn.update(
        ctx,
        dep.id,
        { error: null, type: buttonType, ...tree },
        ncMeta,
      );
      break;
    }
  }
}

/**
 * Re-run the SDK formula check against the table's error-free columns.
 * Returns the parsed tree if it validates, else null. No DB dry-run: on
 * SQLite the meta knex has one connection, held by the open meta trx.
 */
async function revalidateFormulaDependent(
  ctx: NcContext,
  col: Column,
  ncMeta: MetaService,
): Promise<unknown | null> {
  const opt = col.colOptions as FormulaColumn | ButtonColumn | undefined;
  const raw = opt?.formula || opt?.formula_raw;
  if (!raw) return null;
  const expression = normalizeBraces(raw);
  try {
    const table = await Model.get(ctx, col.fk_model_id, false, ncMeta);
    const source = table?.source_id
      ? await Source.get(ctx, table.source_id, false, ncMeta)
      : null;
    if (!table || !source) return null;

    const relatedModels = await getRelatedModelMap(ctx, table, ncMeta);
    return await validateFormulaAndExtractTreeWithType({
      formula: expression,
      columns: table.columns.filter((c) => !c.colOptions?.error),
      column: col,
      clientOrSqlUi: source.type as any,
      getMeta: async (_, { id }) => relatedModels.get(id),
    });
  } catch (e) {
    logger.debug(`Column ${col.id} still fails validation: ${e?.message}`);
    return null;
  }
}

/** Legacy formulas store `{{id}}`; parse them as `{id}`, as formulaQueryBuilderv2 does. */
function normalizeBraces(expression: string): string {
  return expression.replaceAll('{{', '{').replaceAll('}}', '}');
}

/** True if a formula expression names `colId` as an identifier. */
function expressionReads(expression: string, colId: string): boolean {
  let tree: unknown;
  try {
    tree = formulaJsep(normalizeBraces(expression));
  } catch {
    return false;
  }
  const hasIdentifier = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some(hasIdentifier);
    const { type, name } = node as { type?: string; name?: string };
    if (type === 'Identifier' && name === colId) return true;
    return Object.values(node).some(hasIdentifier);
  };
  return hasIdentifier(tree);
}

/** Context of the table a lookup/rollup reads from, via its relation column. */
async function relatedContext(
  ctx: NcContext,
  relationColId: string | null | undefined,
  ncMeta: MetaService,
): Promise<NcContext> {
  if (!relationColId) return ctx;
  const relCol = await Column.get(
    ctx,
    { colId: relationColId, includeDeleted: true },
    ncMeta,
  );
  const relOpt = await relCol?.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
  return relOpt?.getRelContext?.().refContext ?? ctx;
}

/** True if the referenced column is trashed, or is itself cascade-errored. */
async function refIsBroken(
  ctx: NcContext,
  colId: string | null | undefined,
  ncMeta: MetaService,
): Promise<boolean> {
  if (!colId) return false;
  const ref = await Column.get(ctx, { colId, includeDeleted: true }, ncMeta);
  if (!ref) return false;
  if (ref.deleted) return true;
  if (!CASCADE_ERROR_UIDTS.has(ref.uidt)) return false;
  const opt = await ref.getColOptions<{ error?: string }>(ncMeta);
  return !!opt?.error;
}

async function dependentStillBroken(
  ctx: NcContext,
  dep: Dependent,
  col: Column,
  ncMeta: MetaService,
): Promise<boolean> {
  switch (dep.type) {
    case 'lookup': {
      const opt = await col.getColOptions<LookupColumn>(ncMeta);
      if (await refIsBroken(ctx, opt?.fk_relation_column_id, ncMeta)) {
        return true;
      }
      const refCtx = await relatedContext(
        ctx,
        opt?.fk_relation_column_id,
        ncMeta,
      );
      return refIsBroken(refCtx, opt?.fk_lookup_column_id, ncMeta);
    }
    case 'rollup': {
      const opt = await col.getColOptions<RollupColumn>(ncMeta);
      if (await refIsBroken(ctx, opt?.fk_relation_column_id, ncMeta)) {
        return true;
      }
      const refCtx = await relatedContext(
        ctx,
        opt?.fk_relation_column_id,
        ncMeta,
      );
      if (await refIsBroken(refCtx, opt?.fk_rollup_column_id, ncMeta)) {
        return true;
      }
      return rollupSourceIncompatible(refCtx, opt, ncMeta);
    }
    case 'qrcode': {
      const opt = await col.getColOptions<QrCodeColumn>(ncMeta);
      return refIsBroken(ctx, opt?.fk_qr_value_column_id, ncMeta);
    }
    case 'barcode': {
      const opt = await col.getColOptions<BarcodeColumn>(ncMeta);
      return refIsBroken(ctx, opt?.fk_barcode_value_column_id, ncMeta);
    }
    case 'formula':
    case 'button': {
      // Walk the formula against every currently-soft-deleted column in the
      // same table. If any is still referenced → dependent is still broken.
      const opts =
        dep.type === 'formula'
          ? await col.getColOptions<FormulaColumn>(ncMeta)
          : await col.getColOptions<ButtonColumn>(ncMeta);
      if (!opts) return false;
      if (dep.type === 'button' && (opts as ButtonColumn).type !== 'url') {
        return false;
      }
      const hasFormula = !!(opts as FormulaColumn | ButtonColumn).formula;
      if (!hasFormula) return false;

      const siblings = await Column.list(
        ctx,
        { fk_model_id: col.fk_model_id, includeDeleted: true },
        ncMeta,
      );
      const stillTrashed = siblings.filter((c) => c.deleted);
      for (const other of stillTrashed) {
        // Probe against a fresh copy — addFormulaErrorIfMissingColumn mutates.
        const probe = {
          ...(opts as any),
          error: '',
        } as FormulaColumn | ButtonColumn;
        const modified = addFormulaErrorIfMissingColumn({
          formula: probe,
          columnId: other.id,
          title: other.title,
        });
        if (modified) return true;
      }
      return false;
    }
  }
  return false;
}

/** Tell open clients to reload field meta. */
async function broadcastColumnUpdates(
  models: { ctx: NcContext; modelId: string }[],
) {
  for (const { ctx: modelCtx, modelId } of models) {
    const model = await Model.getWithInfo(
      modelCtx,
      { id: modelId },
      Noco.ncMeta,
    );
    if (!model) continue;
    NocoSocket.broadcastEvent(modelCtx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_update',
        payload: { table: model, column: {}, skipDataReload: true },
      },
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }
}

// Left unmarked on a type change: they keep working on text and most stored types.
const ANY_TYPE_ROLLUPS = ['count', 'countDistinct', 'min', 'max'];

/**
 * Whether a rollup function can aggregate `source`. sum/avg follow the create
 * path (validateRollupPayload); the functions above are always allowed.
 */
export function isRollupSourceCompatible(
  source: { uidt: string },
  rollupFunction: string,
): boolean {
  return (
    isRollupAggregatableColumn(source) &&
    (ANY_TYPE_ROLLUPS.includes(rollupFunction) ||
      getAvailableRollupForUiType(source.uidt).includes(rollupFunction))
  );
}

// MySQL/SQLite coerce text in sum/avg instead of failing, so marking there would break working rollups.
const STRICT_AGGREGATE_DIALECTS = ['pg', 'mssql'];

async function failsOnSourceDialect(
  ctx: NcContext,
  source: Pick<Column, 'fk_model_id'>,
  ncMeta: MetaService,
): Promise<boolean> {
  const model = await Model.get(ctx, source.fk_model_id, false, ncMeta);
  if (!model?.source_id) return false;
  const dbSource = await Source.get(ctx, model.source_id, false, ncMeta);
  return STRICT_AGGREGATE_DIALECTS.includes(dbSource?.type);
}

async function rollupSourceIncompatible(
  ctx: NcContext,
  opt: RollupColumn | undefined,
  ncMeta: MetaService,
): Promise<boolean> {
  if (!opt?.fk_rollup_column_id) return false;
  const source = await Column.get(
    ctx,
    { colId: opt.fk_rollup_column_id },
    ncMeta,
  );
  return (
    !!source &&
    !isRollupSourceCompatible(source, opt.rollup_function) &&
    (await failsOnSourceDialect(ctx, source, ncMeta))
  );
}

const COL_ERROR_UPDATERS: Record<
  string,
  (
    ctx: NcContext,
    colId: string,
    data: { error: string },
    ncMeta: MetaService,
  ) => Promise<unknown>
> = {
  lookup: LookupColumn.update.bind(LookupColumn),
  rollup: RollupColumn.update.bind(RollupColumn),
  qrcode: QrCodeColumn.update.bind(QrCodeColumn),
  barcode: BarcodeColumn.update.bind(BarcodeColumn),
};

// Columns that read another column, by the fk that points at it.
const READER_QUERIES: [MetaTable, string, string][] = [
  [MetaTable.COL_LOOKUP, 'fk_lookup_column_id', 'lookup'],
  [MetaTable.COL_ROLLUP, 'fk_rollup_column_id', 'rollup'],
  [MetaTable.COL_QRCODE, 'fk_qr_value_column_id', 'qrcode'],
  [MetaTable.COL_BARCODE, 'fk_barcode_value_column_id', 'barcode'],
];

/**
 * Lookups, rollups, QR codes and barcodes that read `col`: same base, plus
 * cross-base lookups and rollups reached through links out of its table.
 */
export async function findReaders(
  ctx: NcContext,
  col: Column,
  ncMeta: MetaService = Noco.ncMeta,
): Promise<Dependent[]> {
  const readers: Dependent[] = [];
  for (const [table, fkField, type] of READER_QUERIES) {
    const rows = await ncMeta.metaList2(ctx.workspace_id, ctx.base_id, table, {
      condition: { [fkField]: col.id },
    });
    addDependents(
      readers,
      rows.map((row) => ({ id: row.fk_column_id, type, base_id: ctx.base_id })),
    );
  }

  for (const link of await Column.list(
    ctx,
    { fk_model_id: col.fk_model_id },
    ncMeta,
  )) {
    if (!isLinksOrLTAR(link.uidt)) continue;
    const opts = await link.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
    const relatedBaseId = opts?.fk_related_base_id;
    if (!relatedBaseId || relatedBaseId === ctx.base_id) continue;
    for (const [table, fkField, type] of READER_QUERIES) {
      if (type !== 'lookup' && type !== 'rollup') continue;
      const rows = await ncMeta.metaList2(
        ctx.workspace_id,
        relatedBaseId,
        table,
        { condition: { [fkField]: col.id } },
      );
      addDependents(
        readers,
        rows.map((row) => ({
          id: row.fk_column_id,
          type,
          base_id: relatedBaseId,
        })),
      );
    }
  }
  return readers;
}

interface Entry {
  dep: Dependent;
  col: Column;
}

async function loadEntry(
  ctx: NcContext,
  dep: Dependent,
  ncMeta: MetaService,
): Promise<Entry | null> {
  const col = await Column.get(
    dependentContext(ctx, dep),
    { colId: dep.id, includeDeleted: true },
    ncMeta,
  );
  return col ? { dep, col } : null;
}

/**
 * Formulas and URL buttons in `col`'s table whose expression names `col`.
 * Formulas can only reference columns of their own table.
 */
async function findFormulaReaders(
  ctx: NcContext,
  col: Column,
  ncMeta: MetaService,
): Promise<Dependent[]> {
  const readers: Dependent[] = [];
  const columns = await Column.list(
    ctx,
    { fk_model_id: col.fk_model_id, includeDeleted: true },
    ncMeta,
  );
  for (const c of columns) {
    if (c.uidt !== UITypes.Formula && c.uidt !== UITypes.Button) continue;
    const opt = c.colOptions as FormulaColumn | ButtonColumn | undefined;
    if (!opt?.formula) continue;
    if (
      c.uidt === UITypes.Button &&
      (opt as ButtonColumn).type !== ButtonActionsType.Url
    ) {
      continue;
    }
    if (!expressionReads(opt.formula, col.id)) continue;
    readers.push({
      id: c.id,
      type: c.uidt === UITypes.Formula ? 'formula' : 'button',
      base_id: ctx.base_id,
    });
  }
  return readers;
}

/**
 * Every reader downstream of `root`, transitively. `root` is not included.
 * Formula and button readers are walked only when `includeFormulas` is set:
 * the mark side does not error-mark them.
 */
async function downstreamOf(
  ctx: NcContext,
  root: Pick<Dependent, 'id' | 'base_id'>,
  ncMeta: MetaService,
  includeFormulas = false,
): Promise<Entry[]> {
  const seen = new Set<string>([dependentKey(root)]);
  const queue: Pick<Dependent, 'id' | 'base_id'>[] = [root];
  const out: Entry[] = [];
  while (queue.length) {
    const cur = queue.shift();
    const curCtx = dependentContext(ctx, cur);
    const curCol = await Column.get(
      curCtx,
      { colId: cur.id, includeDeleted: true },
      ncMeta,
    );
    if (!curCol) continue;
    const readers = await findReaders(curCtx, curCol, ncMeta);
    if (includeFormulas) {
      addDependents(readers, await findFormulaReaders(curCtx, curCol, ncMeta));
    }
    for (const reader of readers) {
      if (seen.has(dependentKey(reader))) continue;
      seen.add(dependentKey(reader));
      const entry = await loadEntry(ctx, reader, ncMeta);
      if (!entry) continue;
      out.push(entry);
      queue.push(reader);
    }
  }
  return out;
}

/** Clear the errored entries in one pass, so dependency order does not matter. */
async function clearErroredEntries(
  ctx: NcContext,
  entries: Entry[],
  ncMeta: MetaService,
  options: ClearOptions = {},
) {
  const errored = entries
    .filter((e) => e.col.colOptions?.error)
    .map((e) => e.dep);
  if (errored.length) {
    await clearDependentErrorsIfResolved(ctx, errored, ncMeta, [], options);
  }
}

// Repair clears re-run formula validation before clearing its error.
const REPAIR_CLEAR: ClearOptions = { revalidateFormulas: true };

/** Error-mark `root` and everything downstream of it, as the field delete does. */
async function markErrored(
  ctx: NcContext,
  root: Dependent,
  error: string,
  ncMeta: MetaService,
) {
  const rootEntry = await loadEntry(ctx, root, ncMeta);
  if (!rootEntry) return;
  const entries = [rootEntry, ...(await downstreamOf(ctx, root, ncMeta))];

  for (const { dep } of entries) {
    await COL_ERROR_UPDATERS[dep.type](
      dependentContext(ctx, dep),
      dep.id,
      { error },
      ncMeta,
    );
  }

  const affectedModels: AffectedModels = new Map();
  for (const { dep, col } of entries) {
    const depCtx = dependentContext(ctx, dep);
    affectedModels.set(`${depCtx.base_id}:${col.fk_model_id}`, {
      ctx: depCtx,
      modelId: col.fk_model_id,
    });
  }
  await refreshAffectedModels(affectedModels, ncMeta, []);
}

/**
 * A rollup's source changed type. Error-mark each rollup that can no longer
 * aggregate it (with its readers), or clear the error once it can again.
 */
export async function applySourceTypeChange(
  ctx: NcContext,
  source: Column,
  ncMeta: MetaService = Noco.ncMeta,
) {
  const strict = await failsOnSourceDialect(ctx, source, ncMeta);
  for (const dep of await findReaders(ctx, source, ncMeta)) {
    if (dep.type !== 'rollup') continue;
    const entry = await loadEntry(ctx, dep, ncMeta);
    if (!entry) continue;
    const opt = await entry.col.getColOptions<RollupColumn>(ncMeta);
    if (!opt) continue;
    if (strict && !isRollupSourceCompatible(source, opt.rollup_function)) {
      if (!opt.error) {
        await markErrored(
          ctx,
          dep,
          `Field '${source.title}' changed to ${source.uidt}, which rollup '${opt.rollup_function}' cannot aggregate`,
          ncMeta,
        );
      }
    } else if (opt.error) {
      await clearErroredEntries(
        ctx,
        [entry, ...(await downstreamOf(ctx, dep, ncMeta, true))],
        ncMeta,
        REPAIR_CLEAR,
      );
    }
  }
}

/** A column was repaired: clear the errors on its readers that are valid again. */
export async function clearDownstreamErrors(
  ctx: NcContext,
  repaired: Pick<Dependent, 'id' | 'base_id'>,
  ncMeta: MetaService = Noco.ncMeta,
) {
  await clearErroredEntries(
    ctx,
    await downstreamOf(ctx, repaired, ncMeta, true),
    ncMeta,
    REPAIR_CLEAR,
  );
}
