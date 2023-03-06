import {
  ColumnReqType,
  NormalColumnRequestType,
  SqlUIColumn,
  SqlUiFactory,
  UITypes,
} from 'nocodb-sdk';
import Base from '../../models/Base';
import Column from '../../models/Column';

export default async function getColumnPropsFromUIDT(
  column: SqlUIColumn & { uidt: UITypes } & ColumnReqType & {
      altered?: number;
    },
  base: Base
) {
  const sqlUi = SqlUiFactory.create(await base.getConnectionConfig());

  const colProp = sqlUi.getDataTypeForUiType(
    column as Column,
    column?.['meta']?.['ag'] ? 'AG' : 'AI'
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
  if (
    column &&
    selectTypes.includes(newColumn.uidt) &&
    selectTypes.includes(column.uidt as UITypes)
  ) {
    newColumn.dtxp = (column as NormalColumnRequestType).dtxp;
  }

  newColumn.altered = column.altered || 2;

  return { ...newColumn, ...column };
}
