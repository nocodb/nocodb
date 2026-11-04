import {
  ClientType,
  isLinksOrLTAR,
  isRollupFormula,
  isSupportedDisplayValueColumn,
  JSEPNode,
  NcSDKError,
  NcSDKErrorV2,
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
const ROLLUP_NUMERIC_OVERFLOW =
  'The rollup formula produces a number too large for the database on the existing data';

// a data-flagged rollup is re-probed (a full scan, in the background) at most
// this often per column and process, doubling after each failed probe
const HEAL_PROBE_INTERVAL_MS = 5 * 60_000;
const HEAL_PROBE_MAX_INTERVAL_MS = 60 * 60_000;
// a rollup that just passed a full dry run isn't re-scanned by other failed reads
const HEALTHY_TTL_MS = 30_000;
// bounds a dry run; a timed-out one heals and rejects nothing, and flags only
// when the failed read itself points at the rollup
const DRY_RUN_TIMEOUT_MS = 60_000;
// the background heal scan; no one waits on it
const HEAL_DRY_RUN_TIMEOUT_MS = 15 * 60_000;
// a rollup whose dry run timed out isn't re-scanned by other failed reads
const TIMED_OUT_TTL_MS = 10 * 60_000;

class RollupDryRunTimeout extends Error {}

const nextHealProbeAt = new Map<string, number>();
const healIntervals = new Map<string, number>();
const healProbes = new Map<string, Promise<boolean>>();
const healthyUntil = new Map<string, number>();
const timedOutUntil = new Map<string, number>();
const flagProbes = new Map<string, Promise<FlagOutcome>>();

type FlagOutcome =
  | 'healthy'
  | 'flagged'
  | 'changed'
  | 'inconclusive'
  | 'timeout';

// what one failed read's walk over its columns found
interface FallbackWalk {
  // formula rollups whose dry run timed out
  timedOut: Column[];
  // plain formulas, which can raise the same data errors
  formulas: number;
}

// divide by zero, a math domain error (LOG(0)), numeric overflow
const ARITHMETIC_ERROR_CODES = new Set([
  '22012',
  '2201E',
  '22003',
  '2201F',
  'ER_DIVISION_BY_ZERO',
  'ER_DATA_OUT_OF_RANGE',
  'ORA-01476',
  'ORA-01428',
  'ORA-01426',
]);
const MSSQL_ARITHMETIC_ERROR_NUMBERS = new Set([8134, 3623, 8115]);

function isArithmeticError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const code = 'code' in e ? e.code : undefined;
  if (typeof code === 'string' && ARITHMETIC_ERROR_CODES.has(code)) {
    return true;
  }
  const number = driverNumber(e);
  return number !== undefined && MSSQL_ARITHMETIC_ERROR_NUMBERS.has(number);
}

async function flagRollup(column: Column, message: string) {
  await RollupColumn.update(column.context, column.id, {
    error: ROLLUP_DATA_ERROR_MARK + message,
  });
  nextHealProbeAt.set(column.id, Date.now() + HEAL_PROBE_INTERVAL_MS);
  // a fresh flag (e.g. after a save) starts the backoff over
  healIntervals.delete(column.id);
  await clearPlansOf(column.context, column);
}

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

/** A dry run that ran out of time: says nothing about the formula. */
export function isDryRunTimeout(e: unknown): boolean {
  if (e instanceof RollupDryRunTimeout) return true;
  if (typeof e !== 'object' || e === null) return false;
  if ('name' in e && e.name === 'KnexTimeoutError') return true;
  const code = 'code' in e ? e.code : undefined;
  return (
    // pg query_canceled, mysql MAX_EXECUTION_TIME, mssql, oracle
    code === '57014' ||
    code === 'ER_QUERY_TIMEOUT' ||
    code === 'ETIMEOUT' ||
    code === 'ORA-01013' ||
    driverNumber(e) === 3024
  );
}

/**
 * False when the failed read's error is clearly not a rollup failing on the
 * data (a missing table, a syntax or connection error, a bad `where`), so no
 * probe runs. Only database driver errors are probed.
 */
export function isRollupDataError(e: unknown): boolean {
  if (isTransientError(e) || isExternalSourceError(e)) return false;
  // raised by the app (bad request, missing field), not by the database on a value
  if (
    e instanceof NcBaseError ||
    e instanceof NcBaseErrorv2 ||
    e instanceof NcSDKError ||
    e instanceof NcSDKErrorV2
  )
    return false;
  if (typeof e !== 'object' || e === null) return false;
  if (isDryRunTimeout(e)) return false;

  const mssqlNumber = driverNumber(e);
  if (mssqlNumber !== undefined)
    return MSSQL_DATA_ERROR_NUMBERS.has(mssqlNumber);

  const code = 'code' in e && typeof e.code === 'string' ? e.code : undefined;
  if (!code) return false;
  if (code.startsWith('ER_')) return MYSQL_DATA_ERROR_CODES.has(code);
  if (code.startsWith('ORA-')) return ORACLE_DATA_ERROR_CODES.has(code);
  if (/^[0-9A-Z]{5}$/.test(code)) {
    return code.startsWith('22') || PG_DATA_ERROR_CODES.has(code);
  }
  // e.g. SQLITE_ERROR: says nothing either way
  return true;
}

/**
 * `background`: nobody waits on it, so a database that can't cancel the
 * statement runs it to the end rather than leaving it behind a timed-out wait.
 */
export async function execRollupDryRun(
  baseModel: IBaseModelSqlV2,
  builder: Knex.QueryBuilder,
  { background = false }: { background?: boolean } = {},
) {
  const knex = baseModel.dbDriver;
  const qb = knex(baseModel.getTnPath(baseModel.model)).select(
    knex.raw('(??) as ??', [builder, '__nc_dry_run']),
  );
  // counting evaluates every value without sending the rows back
  const countQb = knex
    .count({ n: '__nc_dry_run' })
    .from(qb.as('__nc_dry_run_t'));
  // a heal must be able to finish a scan a read's dry run can't
  const timeoutMs = background ? HEAL_DRY_RUN_TIMEOUT_MS : DRY_RUN_TIMEOUT_MS;
  if (!baseModel.isPg || knex.isExternal) {
    // mysql stops the statement itself; elsewhere only the wait is bounded
    if (baseModel.isMySQL) {
      countQb.hintComment(`MAX_EXECUTION_TIME(${timeoutMs})`);
    }
    if (background) {
      await baseModel.execAndParse(countQb, null, { raw: true });
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        baseModel.execAndParse(countQb, null, { raw: true }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new RollupDryRunTimeout('rollup dry run timed out')),
            DRY_RUN_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
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
    await trx.raw(`SET LOCAL statement_timeout = ${timeoutMs}`);
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
  // the extractor reads overflow as a bad value for a column, which a rollup has none of
  if (typeof e === 'object' && e !== null) {
    const code = 'code' in e ? e.code : undefined;
    if (
      code === '22003' ||
      code === 'ER_DATA_OUT_OF_RANGE' ||
      code === 'ORA-01426' ||
      driverNumber(e) === 8115
    ) {
      return ROLLUP_NUMERIC_OVERFLOW;
    }
  }
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
  if ((timedOutUntil.get(key) ?? 0) > Date.now()) {
    return Promise.resolve<FlagOutcome>('timeout');
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
        if (isDryRunTimeout(e)) {
          // reads must not each repeat a full scan that can't finish
          pruneExpired(timedOutUntil, Date.now());
          timedOutUntil.set(key, Date.now() + TIMED_OUT_TTL_MS);
          return 'timeout';
        }
        // a lock timeout or a permission error says nothing about the formula
        if (!isRollupDataError(e)) return 'inconclusive';
        if (await changedSinceProbe(context, rollup)) return 'changed';
        await flagRollup(column, rollupDryRunMessage(baseModel, e));
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
  walk: FallbackWalk,
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
      !!target && (await flagIfFailing(target, requesting, seen, walk)),
    );
  }

  if (column.uidt === UITypes.Formula) {
    // it can raise the same data errors a rollup can
    walk.formulas++;
    const formula = await column.getColOptions<FormulaColumn>();
    const tree: ParsedFormulaNode | undefined = formula?.getParsedTree();
    let flagged = false;
    for (const colId of new Set(referencedColumnIds(tree))) {
      const referenced = await Column.get(column.context, { colId });
      if (referenced) {
        flagged =
          (await flagIfFailing(referenced, requesting, seen, walk)) || flagged;
      }
    }
    return clearOwnPlans(flagged);
  }

  if (isLinksOrLTAR(column)) {
    const display = await linkDisplayColumn(column);
    return clearOwnPlans(
      !!display && (await flagIfFailing(display, requesting, seen, walk)),
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
    !!target && (await flagIfFailing(target, requesting, seen, walk));
  await clearOwnPlans(targetFlagged);
  if (!isRollupFormula(rollup)) return targetFlagged;

  const outcome = await probeAndFlag(column, rollup);
  if (outcome === 'timeout') walk.timedOut.push(column);
  if (outcome !== 'flagged' && outcome !== 'changed') return targetFlagged;
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
  const walk: FallbackWalk = { timedOut: [], formulas: 0 };
  let flagged = false;
  for (const column of columns) {
    try {
      flagged = (await flagIfFailing(column, baseModel, seen, walk)) || flagged;
    } catch (e) {
      // must not replace the error being reported
      logger.warn(`Rollup check failed on ${column.id}: ${errorMessage(e)}`);
    }
  }
  // Too slow to dry-run: the read's own error is the evidence, but only when
  // nothing else in the read can raise it. A formula can raise any data error;
  // a filter value raises input errors, never an arithmetic one.
  if (
    !flagged &&
    walk.timedOut.length === 1 &&
    walk.formulas === 0 &&
    isArithmeticError(failure)
  ) {
    const [suspect] = walk.timedOut;
    try {
      await flagRollup(suspect, rollupDryRunMessage(baseModel, failure));
      flagged = true;
    } catch (e) {
      logger.warn(`Rollup flag failed on ${suspect.id}: ${errorMessage(e)}`);
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
 * A linked-record read (nested list, `/links`, bt/mm read) through `linkColumn`:
 * when it fails on a formula rollup of the related table, flags the rollup and
 * runs the read once more.
 */
export async function retryLinkedReadOnRollupError<T>(
  baseModel: IBaseModelSqlV2,
  linkColumn: Column | undefined,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (
      !linkColumn ||
      baseModel.dbDriver.isTransaction ||
      !isRollupDataError(e)
    ) {
      throw e;
    }
    let flagged = false;
    try {
      const link = await linkColumn.getColOptions<LinkToAnotherRecordColumn>();
      const related = link ? await link.getRelatedTable() : null;
      if (related) {
        const relatedBaseModel = await getBaseModelSqlFromModelId({
          modelId: related.id,
          context: link.getRelContext().refContext,
        });
        flagged = await flagFailingRollups(
          relatedBaseModel,
          await related.getColumns(),
          e,
        );
      }
    } catch (checkError) {
      logger.warn(
        `Rollup check failed on ${linkColumn.id}: ${errorMessage(checkError)}`,
      );
    }
    if (!flagged) throw e;
    return read();
  }
}

/** Settles once every running self-heal probe has finished (tests). */
export async function settleRollupHeals() {
  await Promise.all(healProbes.values());
}

/**
 * A rollup the read fallback flagged from its data: at most once per interval,
 * starts a background dry run over the same rows the flag covered and clears
 * the error when it passes; the read itself still shows the error. Errors from
 * validation are never touched.
 */
export function healRollupDataError(
  requesting: IBaseModelSqlV2,
  rollup: RollupColumn,
): void {
  if (!rollup.data_error || !isRollupFormula(rollup)) return;

  const id = rollup.fk_column_id;
  if (healProbes.has(id)) return;
  if ((nextHealProbeAt.get(id) ?? 0) > Date.now()) return;
  const interval = healIntervals.get(id) ?? HEAL_PROBE_INTERVAL_MS;
  nextHealProbeAt.set(id, Date.now() + interval);
  healIntervals.set(id, Math.min(interval * 2, HEAL_PROBE_MAX_INTERVAL_MS));

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
      await execRollupDryRun(baseModel, builder, { background: true });
    } catch {
      return false;
    }

    // re-flagged by validation, or saved again, while probing
    const current = await storedRollup(context, id);
    if (
      !current?.error?.startsWith(ROLLUP_DATA_ERROR_MARK) ||
      (await changedSinceProbe(context, rollup))
    ) {
      return false;
    }
    await RollupColumn.update(context, id, { error: null });
    nextHealProbeAt.delete(id);
    healIntervals.delete(id);
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
}
