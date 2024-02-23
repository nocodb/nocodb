import { SqlUiFactory, UITypes } from 'nocodb-sdk';
import type { ColumnReqType, NormalColumnRequestType } from 'nocodb-sdk';
import type Source from '~/models/Source';
import type Column from '~/models/Column';

export default async function getColumnPropsFromUIDT(
  column: ColumnReqType & { altered?: number },
  source: Source,
) {
  const sqlUi = SqlUiFactory.create(await source.getConnectionConfig());

  const colProp = sqlUi.getDataTypeForUiType(
    column as Column,
    column?.['meta']?.['ag'] ? 'AG' : 'AI',
  );
  const newColumn = {
    rqd: false,
    pk: false,
    ai: false,
    cdf: null,
    un: false,
    dtx: 'specificType',
    ...colProp,
  };

  newColumn.dtxp = sqlUi.getDefaultLengthForDatatype(newColumn.dt);
  newColumn.dtxs = sqlUi.getDefaultScaleForDatatype(newColumn.dt);

  const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect];
  if (column && selectTypes.includes(column.uidt as UITypes)) {
    (column as NormalColumnRequestType).dtxp =
      typeof (column as NormalColumnRequestType).dtxp === 'string'
        ? ((column as NormalColumnRequestType).dtxp as string)
            .trim()
            .replace(/'\s*,\s*'/g, "','")
        : (column as NormalColumnRequestType).dtxp;
  }

  newColumn.altered = column.altered || 2;

  const finalColumnMeta = { ...newColumn, ...column };

  if (
    finalColumnMeta.uidt === UITypes.CreatedTime &&
    !('column_name' in finalColumnMeta)
  ) {
    finalColumnMeta.column_name = 'created_at';
  } else if (
    finalColumnMeta.uidt === UITypes.LastModifiedTime &&
    !('column_name' in finalColumnMeta)
  ) {
    finalColumnMeta.column_name = 'updated_at';
  }

  return finalColumnMeta;
}
