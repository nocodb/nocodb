import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  getAvailableAggregations,
  NumericalAggregations,
  UITypes,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  BarcodeColumn,
  FormulaColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { genPgAggregateQuery } from '~/db/aggregations/pg';
import { genMysql2AggregatedQuery } from '~/db/aggregations/mysql2';
import { genSqlite3AggregateQuery } from '~/db/aggregations/sqlite3';

const validateColType = (column: Column, aggregation: string) => {
  const agg = getAvailableAggregations(
    column.uidt,
    column.colOptions?.parsed_tree,
  );

  if (!agg.includes(aggregation)) {
    NcError.badRequest(
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

  const { context, dbDriver: knex, model } = baseModelSqlv2;

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
  const aggType = validateColType(column, aggregation);

  // If the aggregation is not available for the column type, we throw an error.
  if (aggType === 'unknown') {
    NcError.notImplemented(`Aggregation ${aggregation} is not implemented yet`);
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

  let column_name_query = column.column_name;

  if (column.uidt === UITypes.CreatedTime && !column.column_name)
    column_name_query = 'created_at';
  if (column.uidt === UITypes.LastModifiedTime && !column.column_name)
    column_name_query = 'updated_at';
  if (column.uidt === UITypes.CreatedBy && !column.column_name)
    column_name_query = 'created_by';
  if (column.uidt === UITypes.LastModifiedBy && !column.column_name)
    column_name_query = 'updated_by';

  const parsedFormulaType = column.colOptions?.parsed_tree?.dataType;

  /* The following column types require special handling for aggregation:
   * - Links
   * - Rollup
   * - Formula
   * - Lookup
   * - LinkToAnotherRecord
   * These column types require special handling because they are virtual columns and do not have a direct column name.
   * We generate the select query for these columns and use the generated query for aggregation.
   * */
  switch (column.uidt) {
    case UITypes.Links:
    case UITypes.Rollup:
      column_name_query = (
        await genRollupSelectv2({
          baseModelSqlv2,
          knex,
          columnOptions: (await column.getColOptions(context)) as RollupColumn,
        })
      ).builder;
      break;

    case UITypes.Formula:
      {
        const formula = await column.getColOptions<FormulaColumn>(context);
        if (formula.error) {
          aggregation = CommonAggregations.None;
        } else {
          column_name_query = (
            await baseModelSqlv2.getSelectQueryBuilderForFormula(column)
          ).builder;
        }
      }
      break;

    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
      column_name_query = (
        await generateLookupSelectQuery({
          baseModelSqlv2,
          column: column,
          alias: null,
          model,
          isAggregation: true,
        })
      ).builder;
      break;
  }

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
  } else if (knex.client.config.client === 'mysql2') {
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
    NcError.notImplemented(
      `Aggregation is not implemented for ${knex.client.config.client} yet.`,
    );
  }
}
