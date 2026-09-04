import formulaQueryBuilderv2 from './formulaQueryBuilderv2';
import { getLmtSyntheticFormula } from './lmtSyntheticFormula';
import type { TAliasToColumn } from './formula-query-builder.types';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type Column from '~/models/Column';
import type Model from '~/models/Model';
import LmtTrackedField from '~/models/LmtTrackedField';

export { lmbFieldQueryBuilder } from './lmbFieldQueryBuilder';

/**
 * Builds the select expression for a LastModifiedTime column configured to
 * track specific fields (`meta.fields_mode === 'specific'`).
 *
 * Delegates to the formula engine via the synthetic
 * `LAST_MODIFIED_TIME({colId}, …)` formula — the same
 * `greatest()`-over-`nc_row_meta` SQL users get from that formula function.
 * The tracked ids are read from the `nc_col_lmt_tracked_fields` junction.
 */
export async function lmtFieldQueryBuilder({
  baseModel,
  column,
  model,
  tableAlias,
  validateFormula = false,
  aliasToColumn = {},
}: {
  baseModel: IBaseModelSqlV2;
  column: Column;
  model?: Model;
  tableAlias?: string;
  validateFormula?: boolean;
  aliasToColumn?: TAliasToColumn;
}) {
  const context = baseModel.context;
  const refModel = model ?? baseModel.model;
  const columns = await refModel.getColumns(context);

  const trackedIds = await LmtTrackedField.getTrackedFieldIds(
    context,
    column.id,
  );

  const synthetic = getLmtSyntheticFormula(trackedIds, columns);
  if (!synthetic) {
    return { builder: baseModel.dbDriver.raw('NULL') };
  }

  return formulaQueryBuilderv2({
    baseModel,
    tree: synthetic,
    model: refModel,
    column,
    aliasToColumn,
    tableAlias,
    validateFormula,
  });
}
