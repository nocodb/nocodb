import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  getAvailableAggregations,
  NumericalAggregations,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { BarcodeColumn, QrCodeColumn } from '~/models';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import { genPgAggregateQuery } from '~/db/aggregations/pg';
import { genMysql2AggregatedQuery } from '~/db/aggregations/mysql2';
import { genSqlite3AggregateQuery } from '~/db/aggregations/sqlite3';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';

export const validateAggregationColType = (
  context: NcContext,
  column: Column,
  aggregation: string,
  throwError = true,
) => {
  const agg = getAvailableAggregations(
    column.uidt,
    column.colOptions?.parsed_tree,
  );

  if (!agg.includes(aggregation)) {
    if (!throwError) {
      return false;
    }
    NcError.get(context).badRequest(
      `Aggregation ${aggregation} is not available for column type ${column.uidt}`,
    );
  }

  if (
    Object.values(BooleanAggregations).includes(
      aggregation as BooleanAggregations,
    )
  ) {
    return 'boolean';
  }

  if (
    Object.values(CommonAggregations).includes(
      aggregation as CommonAggregations,
    )
  ) {
    return 'common';
  }

  if (
    Object.values(DateAggregations).includes(aggregation as DateAggregations)
  ) {
    return 'date';
  }

  if (
    Object.values(NumericalAggregations).includes(
      aggregation as NumericalAggregations,
    )
  ) {
    return 'numerical';
  }

  if (
    Object.values(AttachmentAggregations).includes(
      aggregation as AttachmentAggregations,
    )
  ) {
    return 'attachment';
  }

  return 'unknown';
};

export default async function applyAggregation({
  baseModelSqlv2,
  aggregation,
  column,
  alias,
}: {
  baseModelSqlv2: BaseModelSqlv2;
  aggregation: string;
  column: Column;
  alias?: string;
}): Promise<string | undefined> {
  if (!aggregation || !column) {
    return;
  }

  const { context, dbDriver: knex } = baseModelSqlv2;

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
  const aggType = validateAggregationColType(context, column, aggregation);

  if (aggType === false) {
    NcError.get(context).notImplemented(
      `Aggregation ${aggregation} is not implemented yet`,
    );
    return;
  }

  // If the aggregation is not available for the column type, we throw an error.
  if (aggType === 'unknown') {
    NcError.get(context).notImplemented(
      `Aggregation ${aggregation} is not implemented yet`,
    );
    return;
  }

  // If the column is a barcode or qr code column, we fetch the column that the virtual column refers to.
  if (column.uidt === UITypes.Barcode || column.uidt === UITypes.QrCode) {
    column = new Column({
      ...(await column
        .getColOptions<BarcodeColumn | QrCodeColumn>(context)
        .then((col) => col.getValueColumn(context))),
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

  const column_name_query = (
    await getColumnNameQuery({
      baseModelSqlv2,
      column,
      context,
    })
  ).builder;

  const parsedFormulaType = column.colOptions?.parsed_tree?.dataType;

  if (knex.client.config.client === 'pg') {
    return genPgAggregateQuery({
      column,
      baseModelSqlv2,
      aggregation,
      column_query: column_name_query,
      parsedFormulaType,
      aggType,
      alias: alias,
    });
  } else if (['mysql', 'mysql2'].includes(knex.client.config.client)) {
    return genMysql2AggregatedQuery({
      column,
      baseModelSqlv2,
      aggregation,
      column_query: column_name_query,
      parsedFormulaType,
      aggType,
      alias: alias,
    });
  } else if (knex.client.config.client === 'sqlite3') {
    return genSqlite3AggregateQuery({
      column,
      baseModelSqlv2,
      aggregation,
      column_query: column_name_query,
      parsedFormulaType,
      aggType,
      alias: alias,
    });
  } else {
    NcError.get(context).notImplemented(
      `Aggregation is not implemented for ${knex.client.config.client} yet.`,
    );
  }
}
