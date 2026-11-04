import {
  ClientType,
  isLinksOrLTAR,
  isRollupFormula,
  isSupportedDisplayValueColumn,
  JSEPNode,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext, ParsedFormulaNode } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  BarcodeColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
} from '~/models';
import { Column, Model, RollupColumn, View } from '~/models';
import { ROLLUP_DATA_ERROR_MARK } from '~/models/RollupColumn';
import Noco from '~/Noco';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';
import {
  isExternalSourceError,
  isTransientError,
} from '~/helpers/db-error/utils';
import {
  getBaseModelSqlFromModelId,
  haveFormulaColumn,
} from '~/helpers/dbHelpers';
import { clearSingleQueryCacheForRenamedColumnReferences } from '~/helpers/singleQueryCacheInvalidator';
import { NcBaseError, NcBaseErrorv2 } from '~/helpers/catchError';
import { setModelContext } from '~/helpers/modelContext';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('rollupReadFallback');

const ROLLUP_EVAL_FAILED = 'The rollup formula could not be evaluated';

// a data-flagged rollup is re-probed at most this often per column and process
const HEAL_PROBE_INTERVAL_MS = 60_000;
// rows the self-heal probe evaluates; a bad row past it is re-flagged on read
const HEAL_PROBE_LIMIT = 1000;
// a rollup that just passed a full dry run isn't re-scanned by other failed reads
const HEALTHY_TTL_MS = 30_000;
// pg: bounds a dry run; a cancelled one is no data error, so it flags nothing
const DRY_RUN_TIMEOUT = '60s';

const nextHealProbeAt = new Map<string, number>();
const healProbes = new Map<string, Promise<boolean>>();
const healthyUntil = new Map<string, number>();
const flagProbes = new Map<string, Promise<FlagOutcome>>();

type FlagOutcome = 'healthy' | 'flagged' | 'changed' | 'inconclusive';

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

// pg SQLSTATE class 22 (data exception) is matched as a whole
const PG_DATA_ERROR_CODES = new Set(['42883', '42804']);
const MYSQL_DATA_ERROR_CODES = new Set([
  'ER_DIVISION_BY_ZERO',
  'ER_DATA_OUT_OF_RANGE',
  'ER_TRUNCATED_WRONG_VALUE',
  'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
  'ER_WRONG_VALUE',
  'ER_WRONG_ARGUMENTS',
  'ER_SP_DOES_NOT_EXIST',
  'ER_INVALID_JSON_TEXT_IN_PARAM',
]);
const MSSQL_DATA_ERROR_NUMBERS = new Set([
  8134, // divide by zero
  3623, // invalid floating point operation (LOG(0))
  8115, // arithmetic overflow
  8114, // error converting data type
  245, // conversion failed
  241, // date/time conversion failed
  206, // operand type clash
  402, // incompatible data types in operator
  8117, // operand data type invalid for operator
  8116, // argument data type invalid for argument
  195, // not a recognized built-in function
]);
const ORACLE_DATA_ERROR_CODES = new Set([
  'ORA-01476', // divisor is equal to zero
  'ORA-01428', // argument out of range (LN(0))
  'ORA-01722', // invalid number
  'ORA-01426', // numeric overflow
  'ORA-00932', // inconsistent datatypes
  'ORA-06502', // numeric or value error
  'ORA-01858',
  'ORA-01861',
]);

function driverNumber(e: object): number | undefined {
  if ('number' in e && typeof e.number === 'number') return e.number;
  // mssql wraps the server error
  if (
    'originalError' in e &&
    typeof e.originalError === 'object' &&
    e.originalError !== null
  ) {
    return driverNumber(e.originalError);
  }
  if ('info' in e && typeof e.info === 'object' && e.info !== null) {
    return driverNumber(e.info);
  }
  return undefined;
}

/**
 * False when the failed read's error is clearly not a rollup failing on the
 * data (a missing table, a syntax or connection error), so no probe runs.
 * An error without a driver code can't be told apart and is probed.
 */
export function isRollupDataError(e: unknown): boolean {
  if (isTransientError(e) || isExternalSourceError(e)) return false;
  // raised by the app (bad request, missing field), not by the database on a value
  if (e instanceof NcBaseError || e instanceof NcBaseErrorv2) return false;
  if (typeof e !== 'object' || e === null) return true;

  const mssqlNumber = driverNumber(e);
  if (mssqlNumber !== undefined)
    return MSSQL_DATA_ERROR_NUMBERS.has(mssqlNumber);

  const code = 'code' in e && typeof e.code === 'string' ? e.code : undefined;
  if (!code) return true;
  if (code.startsWith('ER_')) return MYSQL_DATA_ERROR_CODES.has(code);
  if (code.startsWith('ORA-')) return ORACLE_DATA_ERROR_CODES.has(code);
  if (/^[0-9A-Z]{5}$/.test(code)) {
    return code.startsWith('22') || PG_DATA_ERROR_CODES.has(code);
  }
  // e.g. SQLITE_ERROR: says nothing either way
  return true;
}

export async function execRollupDryRun(
  baseModel: IBaseModelSqlV2,
  builder: Knex.QueryBuilder,
  limit?: number,
) {
  const knex = baseModel.dbDriver;
  const qb = knex(baseModel.getTnPath(baseModel.model)).select(
    knex.raw('(??) as ??', [builder, '__nc_dry_run']),
  );
  if (limit) qb.limit(limit, { skipBinding: true });
  // counting evaluates every value without sending the rows back
  const countQb = knex
    .count({ n: '__nc_dry_run' })
    .from(qb.as('__nc_dry_run_t'));
  if (!baseModel.isPg || knex.isExternal) {
    await baseModel.execAndParse(countQb, null, { raw: true });
    return;
  }
  // pg JIT-compiles a many-aggregate scan for seconds (50 aggregates: ~4-90 s)
  // to then run it in ms; `jit` is missing before pg 11
  // the callback form isn't decorated with the CTE helpers execAndParse uses
  const trx = await knex.transaction();
  try {
    await trx.raw(
      `SELECT set_config(name, 'off', true) FROM pg_settings WHERE name = 'jit'`,
    );
    await trx.raw(`SET LOCAL statement_timeout = '${DRY_RUN_TIMEOUT}'`);
    const trxModel = await Model.getBaseModelSQL(baseModel.context, {
      model: baseModel.model,
      dbDriver: trx,
    });
    await trxModel.execAndParse(countQb, null, { raw: true });
  } finally {
    // read-only: nothing to commit
    await trx.rollback();
  }
}

export function rollupDryRunMessage(baseModel: IBaseModelSqlV2, e: unknown) {
  const clientType = Object.values(ClientType).find(
    (type) => type === baseModel.clientType,
  );
  return (
    DBErrorExtractor.get().extractDbError(e, {
      clientType,
      ignoreDefault: true,
    })?.message ?? ROLLUP_EVAL_FAILED
  );
}

function referencedColumnIds(node: ParsedFormulaNode | undefined): string[] {
  if (!node) return [];
  switch (node.type) {
    case JSEPNode.IDENTIFIER:
      return [node.name];
    case JSEPNode.CALL_EXP:
      return node.arguments.flatMap(referencedColumnIds);
    case JSEPNode.BINARY_EXP:
      return [
        ...referencedColumnIds(node.left),
        ...referencedColumnIds(node.right),
      ];
    case JSEPNode.UNARY_EXP:
      return referencedColumnIds(node.argument);
    default:
      return [];
  }
}

const storedRollup = async (
  context: NcContext,
  fkColumnId: string,
): Promise<Partial<RollupColumn> | undefined> =>
  Noco.ncMeta.metaGet2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_ROLLUP,
    {
      fk_column_id: fkColumnId,
    },
  );

// The formula was saved again while it was being probed.
async function changedSinceProbe(context: NcContext, probed: RollupColumn) {
  const current = await storedRollup(context, probed.fk_column_id);
  return (
    !current ||
    current.rollup_formula !== probed.rollup_formula ||
    current.fk_rollup_column_id !== probed.fk_rollup_column_id ||
    current.fk_relation_column_id !== probed.fk_relation_column_id
  );
}

const probeKey = (rollup: RollupColumn) =>
  `${rollup.fk_column_id}:${rollup.fk_relation_column_id}:${rollup.fk_rollup_column_id}:${rollup.rollup_formula}`;

// entries are keyed by formula text, so expired ones would otherwise pile up
function pruneExpired(map: Map<string, number>, now: number) {
  for (const [key, until] of map) {
    if (until <= now) map.delete(key);
  }
}

// lookups and rollups of this field, on any table, embed its SQL
async function clearPlansOf(context: NcContext, column: Column) {
  context.cacheMap?.clear();
  await View.clearSingleQueryCache(context, column.fk_model_id, null);
  await clearSingleQueryCacheForRenamedColumnReferences(context, column);
}

/**
 * Full dry run of one formula rollup; flags it when it fails on the data.
 * Shared by concurrent failed reads, and skipped while a pass is fresh.
 */
function probeAndFlag(column: Column, rollup: RollupColumn) {
  const key = probeKey(rollup);
  if ((healthyUntil.get(key) ?? 0) > Date.now()) {
    return Promise.resolve<FlagOutcome>('healthy');
  }
  let running = flagProbes.get(key);
  if (!running) {
    running = (async (): Promise<FlagOutcome> => {
      const context = column.context;
      const baseModel = await getBaseModelSqlFromModelId({
        modelId: column.fk_model_id,
        context,
      });
      const { builder, isError } = await genRollupSelectv2({
        baseModelSqlv2: baseModel,
        knex: baseModel.dbDriver,
        columnOptions: rollup,
      });
      if (isError) return 'inconclusive';
      try {
        await execRollupDryRun(baseModel, builder);
        pruneExpired(healthyUntil, Date.now());
        healthyUntil.set(key, Date.now() + HEALTHY_TTL_MS);
        return 'healthy';
      } catch (e) {
        // a lock timeout or a permission error says nothing about the formula
        if (!isRollupDataError(e)) return 'inconclusive';
        if (await changedSinceProbe(context, rollup)) return 'changed';

        await RollupColumn.update(context, column.id, {
          error: ROLLUP_DATA_ERROR_MARK + rollupDryRunMessage(baseModel, e),
        });
        nextHealProbeAt.set(column.id, Date.now() + HEAL_PROBE_INTERVAL_MS);
        await clearPlansOf(context, column);
        return 'flagged';
      }
    })().finally(() => flagProbes.delete(key));
    flagProbes.set(key, running);
  }
  return running;
}

/**
 * True when `column` is, or reads through, a formula rollup that fails on the
 * data, or one already flagged whose SQL a cached plan may still hold.
 * Innermost first, so an outer rollup isn't blamed for its target's failure.
 */
// a link's cell embeds its related table's display value
async function linkDisplayColumn(column: Column): Promise<Column | undefined> {
  const link = await column.getColOptions<LinkToAnotherRecordColumn>();
  const related = link ? await link.getRelatedTable() : null;
  const relatedColumns = related ? await related.getColumns() : [];
  return (
    relatedColumns.find(
      (c) =>
        c.id === link?.fk_display_value_column_id &&
        isSupportedDisplayValueColumn(c),
    ) ?? relatedColumns.find((c) => c.pv)
  );
}

async function flagIfFailing(
  column: Column,
  requesting: IBaseModelSqlV2,
  seen: Set<string>,
): Promise<boolean> {
  if (seen.has(column.id)) return false;
  seen.add(column.id);

  // a table between the failing rollup and the read holds its SQL in plans
  const clearOwnPlans = async (flagged: boolean) => {
    if (flagged) {
      await View.clearSingleQueryCache(
        column.context,
        column.fk_model_id,
        null,
      );
    }
    return flagged;
  };

  if (column.uidt === UITypes.Lookup) {
    const lookup = await column.getColOptions<LookupColumn>();
    if (!lookup || lookup.error) return false;
    const target = await lookup.getLookupColumn();
    return clearOwnPlans(
      !!target && (await flagIfFailing(target, requesting, seen)),
    );
  }

  if (column.uidt === UITypes.Formula) {
    const formula = await column.getColOptions<FormulaColumn>();
    const tree: ParsedFormulaNode | undefined = formula?.getParsedTree();
    let flagged = false;
    for (const colId of new Set(referencedColumnIds(tree))) {
      const referenced = await Column.get(column.context, { colId });
      if (referenced) {
        flagged =
          (await flagIfFailing(referenced, requesting, seen)) || flagged;
      }
    }
    return clearOwnPlans(flagged);
  }

  if (isLinksOrLTAR(column)) {
    const display = await linkDisplayColumn(column);
    return clearOwnPlans(
      !!display && (await flagIfFailing(display, requesting, seen)),
    );
  }

  if (column.uidt !== UITypes.Rollup) return false;

  const rollup = await column.getColOptions<RollupColumn>();
  if (!rollup) return false;
  if (rollup.error) {
    // `error` on a plain rollup means a deleted dependency, not a stale plan
    return clearOwnPlans(isRollupFormula(rollup));
  }

  const target = await rollup.getRollupColumn();
  const targetFlagged =
    !!target && (await flagIfFailing(target, requesting, seen));
  await clearOwnPlans(targetFlagged);
  if (!isRollupFormula(rollup)) return targetFlagged;

  const outcome = await probeAndFlag(column, rollup);
  if (outcome === 'healthy' || outcome === 'inconclusive') return targetFlagged;
  if (outcome === 'flagged' && requesting.model.id !== column.fk_model_id) {
    await View.clearSingleQueryCache(
      requesting.context,
      requesting.model.id,
      null,
    );
  }
  return true;
}

/**
 * True when a column reads a data-flagged rollup through lookups, rollups or
 * formulas: its compiled plan holds the error value, so caching it would
 * outlive the heal.
 */
export async function readsDataFlaggedRollup(
  columns: Column[],
  seen = new Set<string>(),
): Promise<boolean> {
  for (const column of columns) {
    if (seen.has(column.id)) continue;
    seen.add(column.id);
    try {
      const next: Column[] = [];
      if (column.uidt === UITypes.Lookup) {
        const lookup = await column.getColOptions<LookupColumn>();
        const target =
          lookup && !lookup.error ? await lookup.getLookupColumn() : null;
        if (target) next.push(target);
      } else if (column.uidt === UITypes.Rollup) {
        const rollup = await column.getColOptions<RollupColumn>();
        if (rollup?.data_error) return true;
        const target =
          rollup && !rollup.error ? await rollup.getRollupColumn() : null;
        if (target) next.push(target);
      } else if (column.uidt === UITypes.Formula) {
        const formula = await column.getColOptions<FormulaColumn>();
        const tree: ParsedFormulaNode | undefined = formula?.getParsedTree();
        for (const colId of new Set(referencedColumnIds(tree))) {
          const referenced = await Column.get(column.context, { colId });
          if (referenced) next.push(referenced);
        }
      } else if (isLinksOrLTAR(column)) {
        const display = await linkDisplayColumn(column);
        if (display) next.push(display);
      } else if (
        column.uidt === UITypes.QrCode ||
        column.uidt === UITypes.Barcode
      ) {
        const code = await column.getColOptions<QrCodeColumn | BarcodeColumn>();
        const source = code ? await code.getValueColumn() : null;
        if (source) next.push(source);
      }
      if (next.length && (await readsDataFlaggedRollup(next, seen))) {
        return true;
      }
    } catch (e) {
      // a missing colOptions row is not a reason to skip caching
      logger.warn(
        `Rollup plan check failed on ${column.id}: ${errorMessage(e)}`,
      );
    }
  }
  return false;
}

/** True when a formula rollup behind the failed read was flagged. */
export async function flagFailingRollups(
  baseModel: IBaseModelSqlV2,
  columns: Column[],
  failure: unknown,
): Promise<boolean> {
  // the failed statement aborted it (pg), and a separate connection can't see
  // its rows or would wait on its locks (mssql)
  if (baseModel.dbDriver.isTransaction) return false;
  if (!isRollupDataError(failure)) return false;

  const seen = new Set<string>();
  let flagged = false;
  for (const column of columns) {
    try {
      flagged = (await flagIfFailing(column, baseModel, seen)) || flagged;
    } catch (e) {
      // must not replace the error being reported
      logger.warn(`Rollup check failed on ${column.id}: ${errorMessage(e)}`);
    }
  }
  if (flagged) {
    baseModel.context.cacheMap?.clear();
    await View.clearSingleQueryCache(
      baseModel.context,
      baseModel.model.id,
      null,
    );
  }
  return flagged;
}

/**
 * A read just failed: flag any formula rollup behind it (directly or through a
 * lookup, rollup or formula) so its cells show the error instead, as Formula
 * fields do. Returns whether the read is worth retrying with validation.
 */
export async function shouldRetryFailedRead(
  baseModel: IBaseModelSqlV2,
  columns: Column[],
  failure: unknown,
): Promise<boolean> {
  return (
    (await flagFailingRollups(baseModel, columns, failure)) ||
    haveFormulaColumn(columns)
  );
}

/**
 * A rollup the read fallback flagged from its data: re-runs a bounded dry run
 * at most once per interval and clears the error when it passes. True when
 * cleared. Errors from validation are never touched.
 */
export async function healRollupDataError(
  requesting: IBaseModelSqlV2,
  rollup: RollupColumn,
): Promise<boolean> {
  if (!rollup.data_error || !isRollupFormula(rollup)) return false;
  // a failed probe would abort it (pg)
  if (requesting.dbDriver.isTransaction) return false;

  const id = rollup.fk_column_id;
  const running = healProbes.get(id);
  if (running) return running;
  if ((nextHealProbeAt.get(id) ?? 0) > Date.now()) return false;
  nextHealProbeAt.set(id, Date.now() + HEAL_PROBE_INTERVAL_MS);

  const probe = (async () => {
    const context = rollup.context;
    const column = await Column.get(context, { colId: id });
    if (!column) return false;
    const baseModel = await getBaseModelSqlFromModelId({
      modelId: column.fk_model_id,
      context,
    });
    const unflagged = setModelContext(
      new RollupColumn({ ...rollup, error: null, data_error: false }),
      context,
    );
    const { builder, isError } = await genRollupSelectv2({
      baseModelSqlv2: baseModel,
      knex: baseModel.dbDriver,
      columnOptions: unflagged,
    });
    if (isError) return false;
    try {
      await execRollupDryRun(baseModel, builder, HEAL_PROBE_LIMIT);
    } catch {
      return false;
    }

    // re-flagged by validation, or saved again, while probing
    const current = await storedRollup(context, id);
    if (
      !current?.error?.startsWith(ROLLUP_DATA_ERROR_MARK) ||
      current.rollup_formula !== rollup.rollup_formula ||
      current.fk_rollup_column_id !== rollup.fk_rollup_column_id
    ) {
      return false;
    }
    await RollupColumn.update(context, id, { error: null });
    nextHealProbeAt.delete(id);
    requesting.context.cacheMap?.clear();
    await clearPlansOf(context, column);
    return true;
  })()
    .catch((e) => {
      logger.warn(`Rollup self-heal failed on ${id}: ${errorMessage(e)}`);
      return false;
    })
    .finally(() => healProbes.delete(id));
  healProbes.set(id, probe);
  return probe;
}
