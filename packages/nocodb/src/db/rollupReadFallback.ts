import { ClientType, isRollupFormula, JSEPNode, UITypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext, ParsedFormulaNode } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { FormulaColumn, LookupColumn } from '~/models';
import { Column, RollupColumn, View } from '~/models';
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
import { MetaTable } from '~/utils/globals';

const logger = new Logger('rollupReadFallback');

const ROLLUP_EVAL_FAILED = 'The rollup formula could not be evaluated';

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

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
  await baseModel.execAndParse(
    knex.count({ n: '__nc_dry_run' }).from(qb.as('__nc_dry_run_t')),
    null,
    { raw: true },
  );
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

// The formula was saved again while it was being probed.
async function changedSinceProbe(context: NcContext, probed: RollupColumn) {
  const current: Partial<RollupColumn> | undefined =
    await Noco.ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_ROLLUP,
      { fk_column_id: probed.fk_column_id },
    );
  return (
    !current ||
    current.rollup_formula !== probed.rollup_formula ||
    current.fk_rollup_column_id !== probed.fk_rollup_column_id ||
    current.fk_relation_column_id !== probed.fk_relation_column_id
  );
}

/**
 * True when `column` is, or reads through, a formula rollup that fails on the
 * data, or one already flagged whose SQL a cached plan may still hold.
 * Innermost first, so an outer rollup isn't blamed for its target's failure.
 */
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
        flagged = (await flagIfFailing(referenced, requesting, seen)) || flagged;
      }
    }
    return clearOwnPlans(flagged);
  }

  if (column.uidt !== UITypes.Rollup) return false;

  const context = column.context;
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

  const baseModel = await getBaseModelSqlFromModelId({
    modelId: column.fk_model_id,
    context,
  });
  const { builder, isError } = await genRollupSelectv2({
    baseModelSqlv2: baseModel,
    knex: baseModel.dbDriver,
    columnOptions: rollup,
  });
  if (isError) return targetFlagged;

  try {
    await execRollupDryRun(baseModel, builder);
    return targetFlagged;
  } catch (e) {
    // says nothing about the formula
    if (isTransientError(e) || isExternalSourceError(e)) return targetFlagged;
    if (await changedSinceProbe(context, rollup)) return true;

    await RollupColumn.update(context, column.id, {
      error: rollupDryRunMessage(baseModel, e),
    });
    context.cacheMap?.clear();
    await clearOwnPlans(true);
    // lookups and rollups of this field, on any table, embed its SQL
    await clearSingleQueryCacheForRenamedColumnReferences(context, column);
    if (requesting.model.id !== column.fk_model_id) {
      await View.clearSingleQueryCache(
        requesting.context,
        requesting.model.id,
        null,
      );
    }
    return true;
  }
}

/** True when a formula rollup behind the failed read was flagged. */
export async function flagFailingRollups(
  baseModel: IBaseModelSqlV2,
  columns: Column[],
): Promise<boolean> {
  // the failed statement aborted it (pg), and a separate connection can't see
  // its rows or would wait on its locks (mssql)
  if (baseModel.dbDriver.isTransaction) return false;

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
): Promise<boolean> {
  return (
    (await flagFailingRollups(baseModel, columns)) || haveFormulaColumn(columns)
  );
}
