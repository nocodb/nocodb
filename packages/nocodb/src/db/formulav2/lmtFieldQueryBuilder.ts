import formulaQueryBuilderv2 from './formulaQueryBuilderv2';
import { getLmtSyntheticFormula } from './lmtSyntheticFormula';
import type { TAliasToColumn } from './formula-query-builder.types';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type Column from '~/models/Column';
import type Model from '~/models/Model';
import LmtTrackedField from '~/models/LmtTrackedField';

export { lmbFieldQueryBuilder } from './lmbFieldQueryBuilder';

/**
 * Wraps a field-tracking LastModifiedTime expression so it is emitted as text
 * with an explicit `+00:00`, matching the physical-column DateTime selects.
 *
 * The stored `nc_row_meta.modifiedTime` is already UTC wall time, so no zone
 * conversion is applied — only the suffix. Without it the value loses its
 * offset when it passes through `json_agg` (lookups, JSON-built objects) and
 * downstream consumers render UTC as if it were local. Select paths only:
 * filters/sorts/group-by must keep comparing timestamps, not text.
 */
export function lmtUtcText(baseModel: IBaseModelSqlV2, expr: string): string {
  if (!baseModel.isPg) return expr;
  // the ::timestamp cast pins the TO_CHAR overload — the expression degrades to
  // a bare NULL when no tracked ids survive, and to_char(unknown, unknown) is
  // ambiguous in pg
  return `TO_CHAR((${expr})::timestamp, 'YYYY-MM-DD HH24:MI:SS"+00:00"')`;
}

/**
 * Builds the select expression for a LastModifiedTime column configured to
 * track specific fields (`meta.fields_mode === 'specific'`).
 *
 * Delegates to the formula engine via the synthetic
 * `LAST_MODIFIED_TIME({colId}, …)` formula — the same
 * `greatest()`-over-`nc_row_meta` SQL users get from that formula function.
 * The tracked ids are read from the `nc_dependency_tracker` edges.
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
