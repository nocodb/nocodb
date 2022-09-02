import { ColumnType, UITypes } from 'nocodb-sdk';
import request from 'supertest';
import Column from '../../../../../lib/models/Column';
import Model from '../../../../../lib/models/Model';
import Project from '../../../../../lib/models/Project';

const rowValue = (column: ColumnType, index: number) => {
  switch (column.uidt) {
    case UITypes.ID:
      return index;
    case UITypes.Number:
      return index;
    case UITypes.SingleLineText:
      return `test-${index}`;
    case UITypes.Date:
      return '2020-01-01';
    case UITypes.DateTime:
      return '2020-01-01 00:00:00';
    case UITypes.Email:
      return `test-${index}@example.com`;
    default:
      return `test-${index}`;
  }
};

const getRow = async (context, project, table, id) => {
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${project.id}/${table.id}/${id}`)
    .set('xc-auth', context.token);

  return response.body;
};

const getOneRow = async (
  context,
  { project, table }: { project: Project; table: Model }
) => {
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${project.id}/${table.id}/find-one`)
    .set('xc-auth', context.token);

  return response.body;
};

const createRow = async (
  context,
  {
    project,
    table,
    index = 0,
  }: {
    project: Project;
    table: Model;
    index?: number;
  }
) => {
  const columns = await table.getColumns();
  const rowData = columns.reduce((acc, column) => {
    if (
      column.uidt === UITypes.LinkToAnotherRecord ||
      column.uidt === UITypes.ForeignKey
    ) {
      return acc;
    }
    acc[column.column_name] = rowValue(column, index);
    return acc;
  }, {});

  const response = await request(context.app)
    .post(`/api/v1/db/data/noco/${project.id}/${table.id}`)
    .set('xc-auth', context.token)
    .send(rowData);

  return response.body;
};

// Links 2 table rows together. Will create rows if ids are not provided
const createRelation = async (
  context,
  {
    project,
    table,
    childTable,
    column,
    rowId,
    childRowId,
    type,
  }: {
    project: Project;
    table: Model;
    childTable: Model;
    column: Column;
    rowId?: string;
    childRowId?: string;
    type: string;
  }
) => {
  if (!rowId) {
    const row = await createRow(context, { project, table });
    rowId = row['Id'];
  }

  if (!childRowId) {
    const row = await createRow(context, { table: childTable, project });
    childRowId = row['Id'];
  }

  await request(context.app)
    .post(
      `/api/v1/db/data/noco/${project.id}/${table.id}/${rowId}/${type}/${column.title}/${childRowId}`
    )
    .set('xc-auth', context.token);
};

export { createRow, getRow, createRelation, getOneRow };
