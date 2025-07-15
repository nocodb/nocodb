import { UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type {
  BarcodeColumn,
  FormulaColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import type { NcContext } from '~/interface/config';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { Column } from '~/models';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import genRollupSelectv2 from '~/db/genRollupSelectv2';

/**
 * Get the column name query for a column
 * This is extracted from the aggregation.ts file to make it reusable
 *
 * @param {Object} param0 - The parameters
 * @param {BaseModelSqlv2} param0.baseModelSqlv2 - The base model SQL v2 instance
 * @param {Column} param0.column - The column
 * @param {NcContext} [param0.context] - The context
 * @returns {Promise<string>} - The column name query
 */
export async function getColumnNameQuery({
  baseModelSqlv2,
  column,
  context,
}: {
  baseModelSqlv2: BaseModelSqlv2;
  column: Column;
  context: NcContext;
}): Promise<{
  builder: Knex.QueryBuilder | string;
}> {
  // If the column is a barcode or qr code column, we fetch the column that the virtual column refers to.
  if (column.uidt === UITypes.Barcode || column.uidt === UITypes.QrCode) {
    column = new Column({
      ...(await column
        .getColOptions<BarcodeColumn | QrCodeColumn>(context)
        .then((col) => col.getValueColumn(context))),
      id: column.id,
    });
  }

  let column_name_query: any = column.column_name;

  if (column.uidt === UITypes.CreatedTime && !column.column_name)
    column_name_query = 'created_at';
  if (column.uidt === UITypes.LastModifiedTime && !column.column_name)
    column_name_query = 'updated_at';
  if (column.uidt === UITypes.CreatedBy && !column.column_name)
    column_name_query = 'created_by';
  if (column.uidt === UITypes.LastModifiedBy && !column.column_name)
    column_name_query = 'updated_by';

  /* The following column types require special handling:
   * - Links
   * - Rollup
   * - Formula
   * - Lookup
   * - LinkToAnotherRecord
   * These column types require special handling because they are virtual columns and do not have a direct column name.
   * We generate the select query for these columns and use the generated query.
   * */
  switch (column.uidt) {
    case UITypes.Links:
    case UITypes.Rollup: {
      const knex = baseModelSqlv2.dbDriver;
      column_name_query = await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        columnOptions: (await column.getColOptions(context)) as RollupColumn,
      });
      break;
    }

    case UITypes.Formula: {
      const formula = await column.getColOptions<FormulaColumn>(context);
      if (!formula.error) {
        column_name_query =
          await baseModelSqlv2.getSelectQueryBuilderForFormula(column);
      }
      break;
    }

    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup: {
      const model = await column.getModel(context);
      column_name_query = await generateLookupSelectQuery({
        baseModelSqlv2,
        column: column,
        alias: null,
        model,
        isAggregation: true,
      });
      break;
    }

    case UITypes.Checkbox: {
      column_name_query = {
        builder: baseModelSqlv2.dbDriver.raw(`COALESCE(??, false)`, [
          column_name_query,
        ]),
      };
    }
  }
  return typeof column_name_query === 'string'
    ? {
        builder: column_name_query,
      }
    : column_name_query;
}
