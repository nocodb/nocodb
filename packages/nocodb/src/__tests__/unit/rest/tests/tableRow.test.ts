// import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import server from '../server';
import { createUser } from './helpers/user';
import { createTable } from './helpers/table';
import { createProject } from './helpers/project';
import { createRow } from './helpers/row';
import { createColumn } from './helpers/column';
import { ColumnType, isSystemColumn } from 'nocodb-sdk';
import Column from '../../../../lib/models/Column';

function tableTest() {
  let app;
  let token;
  let project;
  let table;
  let columns: ColumnType[] = [];

  const createRows = async (count = 10) => {
    await Promise.all(
      Array(count)
        .fill(0)
        .map(async (_, index) =>
          createRow(app, token, project, table, columns, index)
        )
    );
  };

  beforeEach(async function () {
    app = await server();
    const response = await createUser(app, { roles: 'editor' });
    token = response.token;

    project = await createProject(app, token);
    table = await createTable(app, token, project);
    const columnsData = [
      {
        title: 'New Title',
        column_name: 'new_title',
        uidt: 'SingleLineText',
      },
      {
        title: 'Priority',
        column_name: 'priority',
        uidt: 'Number',
      },
    ];
    for (const columnData of columnsData) {
      await createColumn(app, token, table, columnData);
    }
    columns = (await Column.list({ fk_model_id: table.id })).filter(
      (col) => !isSystemColumn(col)
    );
  });

  it('Get table data list', async function () {
    const rowCount = 10;
    await createRows(rowCount);

    const response = await request(app)
      .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', token)
      .send({})
      .expect(200);

    if (response.body.list.length !== rowCount) {
      throw new Error('Wrong number of rows');
    }
  });

  it('Get table data list with required columns', async function () {
    const rowCount = 10;
    await createRows(rowCount);
    const newTitleColumn = columns.find((col) => col.title === 'New Title');
    const visibleColumns = [newTitleColumn.title];

    const response = await request(app)
      .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', token)
      .query({
        fields: visibleColumns,
      })
      .expect(200);

    if (response.body.list.length !== rowCount) {
      throw new Error('Wrong number of rows');
    }

    const sameArrayContent = (a: Array<any>, b: Array<any>) => {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    };

    if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
      console.error(Object.keys(response.body.list[0]), visibleColumns);
      throw new Error('Wrong column value');
    }
  });

  it('Get desc sorted table data list with required columns', async function () {
    const rowCount = 10;
    await createRows(rowCount);
    const newTitleColumn = columns.find((col) => col.title === 'New Title');
    const visibleColumns = [newTitleColumn.title];
    const sortInfo = [{ fk_column_id: newTitleColumn.id, direction: 'desc' }];

    const response = await request(app)
      .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', token)
      .query({
        fields: visibleColumns,
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);

    console.log(response.body.list);

    if (response.body.list.length !== rowCount) {
      throw new Error('Wrong number of rows');
    }

    const sameArrayContent = (a: Array<any>, b: Array<any>) => {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    };

    if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
      console.error(Object.keys(response.body.list[0]), visibleColumns);
      throw new Error('Wrong column value');
    }

    if (
      response.body.list[0][newTitleColumn.title] !== 'test-9' ||
      response.body.list[response.body.list.length - 1][
        newTitleColumn.title
      ] !== 'test-0'
    ) {
      throw new Error('Wrong sort');
    }
  });

  it('Get asc sorted table data list with required columns', async function () {
    const rowCount = 10;
    await createRows(rowCount);
    const newTitleColumn = columns.find((col) => col.title === 'New Title');
    const visibleColumns = [newTitleColumn.title];
    const sortInfo = [{ fk_column_id: newTitleColumn.id, direction: 'asc' }];

    const response = await request(app)
      .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', token)
      .query({
        fields: visibleColumns,
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);

    console.log(response.body.list);

    if (response.body.list.length !== rowCount) {
      throw new Error('Wrong number of rows');
    }

    const sameArrayContent = (a: Array<any>, b: Array<any>) => {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    };

    if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
      console.error(Object.keys(response.body.list[0]), visibleColumns);
      throw new Error('Wrong column value');
    }

    if (
      response.body.list[0][newTitleColumn.title] !== 'test-0' ||
      response.body.list[response.body.list.length - 1][
        newTitleColumn.title
      ] !== 'test-9'
    ) {
      throw new Error('Wrong sort');
    }
  });
}

export default function () {
  describe('TableRow', tableTest);
}
