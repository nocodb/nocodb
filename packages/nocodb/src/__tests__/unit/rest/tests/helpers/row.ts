import { ColumnType, UITypes } from 'nocodb-sdk';
import request from 'supertest';

const rowValue = (column: ColumnType, index: number) => {
  switch (column.uidt) {
    case UITypes.Number:
      return index;
    case UITypes.SingleLineText:
      return `test-${index}`;
    case UITypes.Date:
      return '2020-01-01';
    case UITypes.DateTime:
      return '2020-01-01 00:00:00';
    default:
      return `test-${index}`;
  }
};

const createRow = async (
  context,
  project,
  table,
  columns: ColumnType[],
  index
) => {
  const rowData = columns.reduce((acc, column) => {
    acc[column.column_name] = rowValue(column, index);
    return acc;
  }, {});

  const response = await request(context.app)
    .post(`/api/v1/db/data/noco/${project.id}/${table.id}`)
    .set('xc-auth', context.token)
    .send(rowData);

  return response.body;
};

export { createRow };
