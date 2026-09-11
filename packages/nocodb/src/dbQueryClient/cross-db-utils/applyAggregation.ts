import {
  FormulaDataTypes,
  NumericalAggregations,
  UITypes,
  validateAggregationColType,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { BarcodeColumn, QrCodeColumn } from '~/models';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import { excludeNonFiniteSql, isPgIeeeEnabled } from '~/db/formulav2/pg-ieee';
import { DBQueryClient } from '~/dbQueryClient';

export interface ApplyAggregationParams {
  baseModelSqlv2: IBaseModelSqlV2;
  aggregation: string;
  column: Column;
  alias?: string;
  baseQuery?: Knex.QueryBuilder;
}

/**
 * Per-column aggregation SQL builder shared across widget handlers, group-by,
 * and the `client.{aggregate, bulkAggregate}` orchestrations.
 *
 * The prelude is dialect-agnostic — validate the (column, aggregation) pair
 * via SDK, unwrap barcode / QR-code virtual columns, and resolve the column's
 * SELECT expression via `getColumnNameQuery`. Then dispatch to the dialect's
 * `gen{Pg,Mysql2,Sqlite3,Mssql}AggregateQuery` through the
 * `DBQueryClient.fromKnex(...)` factory.
 *
 * Returns `undefined` when the column has no aggregation or carries a stored
 * `colOptions.error`. Throws `NcError.notImplemented` for aggregation × UIType
 * combinations the SDK validator rejects.
 */
export async function applyAggregation({
  baseModelSqlv2,
  aggregation,
  column,
  alias,
  baseQuery,
}: ApplyAggregationParams): Promise<string | undefined> {
  if (!aggregation || !column) {
    return;
  }

  if (column.colOptions?.error) {
    return;
  }

  const { context } = baseModelSqlv2;

  /*
  All aggregations are not available for all UITypes. We validate the column type
  and the aggregation type to make sure that the aggregation is available for the column type.
  We also return the type of aggregation that has to be applied on the column.
  The return value can be one of the following:
  - common       - common aggregations like count, count empty, count filled, count unique, etc.
  - numerical    - numerical aggregations like sum, avg, min, max, etc.
  - boolean      - boolean aggregations like checked, unchecked, percent checked, percent unchecked, etc.
  - date         - date aggregations like earliest date, latest date, date range, month range, etc.
  - attachment   - attachment aggregations like attachment size.
  - unknown      - if the aggregation is not supported yet
  */
  const aggType = validateAggregationColType(column, aggregation);

  if (aggType === false || aggType === 'unknown') {
    NcError.get(context).notImplemented(
      `Aggregation ${aggregation} is not implemented yet`,
    );
    return;
  }

  // If the column is a barcode or qr code column, we fetch the column that the virtual column refers to.
  if (column.uidt === UITypes.Barcode || column.uidt === UITypes.QrCode) {
    column = new Column({
      ...(await column
        .getColOptions<BarcodeColumn | QrCodeColumn>()
        .then((col) => col.getValueColumn())),
      id: column.id,
    });
  }

  /* The following column types require special handling:
   * - Links
   * - Rollup
   * - Formula
   * - Lookup
   * - LinkToAnotherRecord
   * These column types require special handling because they are virtual columns and do not have a direct column name.
   * We generate the select query for these columns and use the generated query.
   * */
  let column_name_query = (
    await getColumnNameQuery({
      baseModelSqlv2,
      column,
      context,
    })
  ).builder;

  const parsedFormulaType = column.colOptions?.parsed_tree?.dataType;

  // A pg numeric formula resolves to the IEEE value the cell shows, and a
  // single NaN would take SUM/AVG/MAX for the whole column with it. Drop the
  // non-finite rows to NULL so they are skipped instead. Numeric aggregations
  // only — an Infinity cell is not empty, so the count family must keep seeing
  // it. Cells, filters, sorts and group keys all want the value itself.
  if (
    column.uidt === UITypes.Formula &&
    parsedFormulaType === FormulaDataTypes.NUMERIC &&
    isPgIeeeEnabled(baseModelSqlv2.dbDriver) &&
    Object.values(NumericalAggregations).includes(aggregation as any) &&
    typeof column_name_query !== 'string'
  ) {
    // excludeNonFiniteSql mentions the expression twice, so it needs two binds.
    column_name_query = baseModelSqlv2.dbDriver.raw(excludeNonFiniteSql('??'), [
      column_name_query,
      column_name_query,
    ]) as any;
  }

  return DBQueryClient.fromKnex(baseModelSqlv2.dbDriver).generateAggregateQuery(
    {
      column,
      baseModelSqlv2,
      aggregation,
      column_query: column_name_query,
      parsedFormulaType,
      aggType,
      alias,
      baseQuery,
    },
  );
}

export default applyAggregation;
