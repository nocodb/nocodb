import { ColumnType, UITypes } from 'nocodb-sdk';
import request from 'supertest';
import Column from '../../../src/lib/models/Column';
import Filter from '../../../src/lib/models/Filter';
import Model from '../../../src/lib/models/Model';
import Project from '../../../src/lib/models/Project';
import Sort from '../../../src/lib/models/Sort';
import NcConnectionMgrv2 from '../../../src/lib/utils/common/NcConnectionMgrv2';

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
    case UITypes.Email:
      return `test-${index}@example.com`;
    default:
      return `test-${index}`;
  }
};

const getRow = async (context, {project, table, id}) => {
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${project.id}/${table.id}/${id}`)
    .set('xc-auth', context.token);

  if(response.status !== 200) {
    return undefined
  }

  return response.body;
};

const listRow = async ({
  project,
  table,
  options,
}: {
  project: Project;
  table: Model;
  options?: {
    limit?: any;
    offset?: any;
    filterArr?: Filter[];
    sortArr?: Sort[];
  };
}) => {
  const bases = await project.getBases();
  const baseModel = await Model.getBaseModelSQL({
    id: table.id,
    dbDriver: NcConnectionMgrv2.get(bases[0]!),
  });

  const ignorePagination = !options;

  return await baseModel.list(options, ignorePagination);
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

const generateDefaultRowAttributes = ({
  columns,
  index = 0,
}: {
  columns: ColumnType[];
  index?: number;
}) =>
  columns.reduce((acc, column) => {
    if (
      column.uidt === UITypes.LinkToAnotherRecord ||
      column.uidt === UITypes.ForeignKey ||
      column.uidt === UITypes.ID
    ) {
      return acc;
    }
    acc[column.title!] = rowValue(column, index);
    return acc;
  }, {});

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
  const rowData = generateDefaultRowAttributes({ columns, index });

  const response = await request(context.app)
    .post(`/api/v1/db/data/noco/${project.id}/${table.id}`)
    .set('xc-auth', context.token)
    .send(rowData);

  return response.body;
};

const createBulkRows = async (
  context,
  {
    project,
    table,
    values
  }: {
    project: Project;
    table: Model;
    values: any[];
  }) => {
    await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send(values)
      .expect(200);
  }

// Links 2 table rows together. Will create rows if ids are not provided
const createChildRow = async (
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

  const row = await getRow(context, { project, table, id: rowId });

  return row;
};

export {
  createRow,
  getRow,
  createChildRow,
  getOneRow,
  listRow,
  generateDefaultRowAttributes,
  createBulkRows
};
