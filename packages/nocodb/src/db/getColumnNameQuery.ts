import { NC_ERROR_SENTINEL, UITypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Knex } from 'knex';
import type {
  BarcodeColumn,
  FormulaColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { Column } from '~/models';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { boolSqlLiteral } from '~/helpers/dbHelpers';
import Noco from '~/Noco';

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
  ncMeta = Noco.ncMeta,
}: {
  baseModelSqlv2: IBaseModelSqlV2;
  column: Column;
  context: NcContext;
  ncMeta?: MetaService;
}): Promise<{
  builder: Knex.QueryBuilder | string;
}> {
  // If the column is a barcode or qr code column, we fetch the column that the virtual column refers to.
  if (column.uidt === UITypes.Barcode || column.uidt === UITypes.QrCode) {
    const colOpt = await column.getColOptions<BarcodeColumn | QrCodeColumn>(
      context,
      ncMeta,
    );
    if (!colOpt || colOpt.error) {
      return { builder: NC_ERROR_SENTINEL };
    }
    const valueColumn = await colOpt.getValueColumn(context, ncMeta);
    if (!valueColumn) {
      return { builder: NC_ERROR_SENTINEL };
    }
    column = new Column({
      ...valueColumn,
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
      const rollupOpt = (await column.getColOptions(
        context,
        ncMeta,
      )) as RollupColumn;
      if (!rollupOpt || rollupOpt.error) break;
      const knex = baseModelSqlv2.dbDriver;
      column_name_query = await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        columnOptions: rollupOpt,
      });
      break;
    }

    case UITypes.Formula: {
      const formula = await column.getColOptions<FormulaColumn>(
        context,
        ncMeta,
      );
      if (!formula.error) {
        column_name_query =
          await baseModelSqlv2.getSelectQueryBuilderForFormula(column);
      }
      break;
    }

    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup: {
      if (column.uidt === UITypes.Lookup) {
        const lookupOpt = await column.getColOptions<LookupColumn>(
          context,
          ncMeta,
        );
        if (lookupOpt?.error) break;
      }
      const model = await column.getModel(context, ncMeta);
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
      const falseLiteral = boolSqlLiteral(baseModelSqlv2, false);
      column_name_query = {
        builder: baseModelSqlv2.dbDriver.raw(`COALESCE(??, ${falseLiteral})`, [
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
