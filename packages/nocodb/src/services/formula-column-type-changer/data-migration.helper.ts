import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, Model } from '~/models';

export const getIdOffsetTable = ({
  baseModelSqlV2,
  alias = 'id_offset_tbl',
  limit,
  offset,
}: {
  baseModelSqlV2: IBaseModelSqlV2;
  limit: number;
  offset: number;
  alias?: string;
}) => {
  return baseModelSqlV2
    .dbDriver(baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name, alias))
    .select(
      getPrimaryKeySelectColumns({
        model: baseModelSqlV2.model,
        sourceTable: alias,
      }),
    )
    .orderBy(
      getPrimaryKeySortColumns({
        model: baseModelSqlV2.model,
        sourceTable: alias,
      }),
    )
    .limit(limit)
    .offset(offset);
};

export const getUpdatedRowsQb = (param: {
  baseModelSqlV2: IBaseModelSqlV2;
  destinationColumn: Column;
  limit: number;
  offset: number;
  alias?: string;
}) => {
  const { baseModelSqlV2, alias = 'id_offset_tbl', destinationColumn } = param;
  return getIdOffsetTable(param)
    .clearSelect()
    .select({
      ...getPrimaryKeySelectColumns({
        model: baseModelSqlV2.model,
        sourceTable: alias,
      }),
      [destinationColumn.title]: baseModelSqlV2.dbDriver.raw(`??.??`, [
        alias,
        destinationColumn.column_name,
      ]),
    });
};

export const getUpdatedRows = async (param: {
  baseModelSqlV2: IBaseModelSqlV2;
  destinationColumn: Column;
  limit: number;
  offset: number;
  alias?: string;
}) => {
  const { baseModelSqlV2 } = param;
  const updatedRows = await await baseModelSqlV2.execAndParse(
    getUpdatedRowsQb(param).toQuery(),
    null,
    { raw: true },
  );
  const result: { primaryKeys: any; row: any }[] = [];
  for (const row of updatedRows) {
    result.push(
      extractPrimaryKeyForAudit({
        model: baseModelSqlV2.model,
        row,
      }),
    );
  }
  return result;
};

export const extractPrimaryKeyForAudit = ({
  model,
  row,
}: {
  model: Model;
  row: Record<string, any>;
}) => {
  if (model.primaryKeys.length === 1) {
    const rowResult = { ...row };
    rowResult[model.primaryKeys[0].column_name] = undefined;
    return {
      primaryKeys: row[model.primaryKeys[0].column_name],
      row: rowResult,
    };
  }

  const result: any = {};
  const rowResult = { ...row };
  for (const pk of model.primaryKeys) {
    result[pk.column_name] = row[pk.column_name];
    rowResult[pk.column_name] = undefined;
  }
  return { primaryKeys: result, row: rowResult };
};

export const getPrimaryKeySelectColumns = ({
  model,
  sourceTable,
}: {
  model: Model;
  sourceTable?: string;
}) => {
  return model.primaryKeys.reduce((props, col) => {
    const prefix = sourceTable ? `${sourceTable}.` : '';
    props[col.column_name] = `${prefix}${col.column_name}`;
    return props;
  }, {});
};

export const getPrimaryKeySortColumns = (param: {
  model: Model;
  sourceTable?: string;
}) =>
  Object.keys(getPrimaryKeySelectColumns(param)).map((colName) => {
    return {
      column: colName,
      order: 'asc',
    };
  });
