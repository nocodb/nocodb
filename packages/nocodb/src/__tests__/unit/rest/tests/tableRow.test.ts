// import { expect } from 'chai';
import 'mocha';
import { createExternalProject } from './helpers/project';
import Model from '../../../../lib/models/Model';
import init from '../init';

function tableTest() {
  let context;
  let project;

  beforeEach(async function () {
    context = await init();

    project = await createExternalProject(context);
  });

  // it('Get table data list', async function () {
  //   const rowCount = 10;
  //   await createRows(rowCount);

  //   const response = await request(app)
  //     .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
  //     .set('xc-auth', token)
  //     .send({})
  //     .expect(200);

  //   if (response.body.list.length !== rowCount) {
  //     throw new Error('Wrong number of rows');
  //   }
  // });

  // it('Get table data list with required columns', async function () {
  //   const rowCount = 10;
  //   await createRows(rowCount);
  //   const newTitleColumn = columns.find((col) => col.title === 'New Title');
  //   const visibleColumns = [newTitleColumn.title];

  //   const response = await request(app)
  //     .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
  //     .set('xc-auth', token)
  //     .query({
  //       fields: visibleColumns,
  //     })
  //     .expect(200);

  //   if (response.body.list.length !== rowCount) {
  //     throw new Error('Wrong number of rows');
  //   }

  //   const sameArrayContent = (a: Array<any>, b: Array<any>) => {
  //     return a.length === b.length && a.every((v, i) => v === b[i]);
  //   };

  //   if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
  //     console.error(Object.keys(response.body.list[0]), visibleColumns);
  //     throw new Error('Wrong column value');
  //   }
  // });

  // it('Get desc sorted table data list with required columns', async function () {
  //   const rowCount = 10;
  //   await createRows(rowCount);
  //   const newTitleColumn = columns.find((col) => col.title === 'New Title');
  //   const visibleColumns = [newTitleColumn.title];
  //   const sortInfo = [{ fk_column_id: newTitleColumn.id, direction: 'desc' }];

  //   const response = await request(app)
  //     .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
  //     .set('xc-auth', token)
  //     .query({
  //       fields: visibleColumns,
  //       sortArrJson: JSON.stringify(sortInfo),
  //     })
  //     .expect(200);

  //   if (response.body.list.length !== rowCount) {
  //     throw new Error('Wrong number of rows');
  //   }

  //   const sameArrayContent = (a: Array<any>, b: Array<any>) => {
  //     return a.length === b.length && a.every((v, i) => v === b[i]);
  //   };

  //   if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
  //     console.error(Object.keys(response.body.list[0]), visibleColumns);
  //     throw new Error('Wrong column value');
  //   }

  //   if (
  //     response.body.list[0][newTitleColumn.title] !== 'test-9' ||
  //     response.body.list[response.body.list.length - 1][
  //       newTitleColumn.title
  //     ] !== 'test-0'
  //   ) {
  //     throw new Error('Wrong sort');
  //   }
  // });

  // it('Get asc sorted table data list with required columns', async function () {
  //   const rowCount = 10;
  //   await createRows(rowCount);
  //   const newTitleColumn = columns.find((col) => col.title === 'New Title');
  //   const visibleColumns = [newTitleColumn.title];
  //   const sortInfo = [{ fk_column_id: newTitleColumn.id, direction: 'asc' }];

  //   const response = await request(app)
  //     .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
  //     .set('xc-auth', token)
  //     .query({
  //       fields: visibleColumns,
  //       sortArrJson: JSON.stringify(sortInfo),
  //     })
  //     .expect(200);

  //   if (response.body.list.length !== rowCount) {
  //     throw new Error('Wrong number of rows');
  //   }

  //   const sameArrayContent = (a: Array<any>, b: Array<any>) => {
  //     return a.length === b.length && a.every((v, i) => v === b[i]);
  //   };

  //   if (!sameArrayContent(Object.keys(response.body.list[0]), visibleColumns)) {
  //     console.error(Object.keys(response.body.list[0]), visibleColumns);
  //     throw new Error('Wrong column value');
  //   }

  //   if (
  //     response.body.list[0][newTitleColumn.title] !== 'test-0' ||
  //     response.body.list[response.body.list.length - 1][
  //       newTitleColumn.title
  //     ] !== 'test-9'
  //   ) {
  //     throw new Error('Wrong sort');
  //   }
  // });

  it('Get actors', async () => {
    const actorTable = await Model.getByIdOrName({
      project_id: project.id,
      base_id: project.bases[0].id,
      table_name: 'actor',
    });
    console.log(actorTable);
  });
}

export default function () {
  describe('TableRow', tableTest);
}
