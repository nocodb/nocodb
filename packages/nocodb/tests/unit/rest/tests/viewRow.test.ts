import 'mocha';
import { createProject, createSakilaProject } from './factory/project';
import init from '../init';
import request from 'supertest';
import Project from '../../../../src/lib/models/Project';
import Model from '../../../../src/lib/models/Model';
import { getTable } from './factory/table';
import View from '../../../../src/lib/models/View';
import { ColumnType } from 'nocodb-sdk';

const isColumnsCorrectInResponse = (row, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const customerColumnsListStr = columns
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === customerColumnsListStr;
};

function tableTest() {
  let context;
  let project: Project;
  let sakilaProject: Project;
  let customerTable: Model;
  let customerColumns;

  beforeEach(async function () {
    context = await init();

    sakilaProject = await createSakilaProject(context);
    project = await createProject(context);
    customerTable = await getTable({project: sakilaProject, name: 'customer'})
    customerColumns = await customerTable.getColumns();
  });

  it.only('Get view row list', async () => {
    const view = (await View.list(customerTable.id))[0]
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body.pageInfo;

    if(pageInfo.totalRows !== 599 || response.body.list[0]['CustomerId'] !== 1){
      throw new Error('View row list is not correct');
    }
  })

  it('Get table data list with required columns', async function () {
    const view = (await View.list(customerTable.id))[0]
    const requiredColumns = customerColumns.filter((_, index) => index < 3);

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: requiredColumns.map((c) => c.title),
      })
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response.body.list[0], requiredColumns)) {
      throw new Error('Wrong columns');
    }
  });

  it('Get desc sorted table data list with required columns', async function () {
    const view = (await View.list(customerTable.id))[0]
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'desc' }];

    const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response.body.list[0], visibleColumns)) {
      console.log(response.body.list);
      throw new Error('Wrong columns');
    }

    if (response.body.list[0][firstNameColumn.title] !== 'ZACHARY') {
      console.log(response.body.list);
      throw new Error('Wrong sort');
    }

    const lastPageOffset =
      Math.trunc(pageInfo.totalRows / pageInfo.pageSize) * pageInfo.pageSize;
    const lastPageResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
        offset: lastPageOffset,
      })
      .expect(200);

    if (
      lastPageResponse.body.list[lastPageResponse.body.list.length - 1][
        firstNameColumn.title
      ] !== 'AARON'
    ) {
      console.log(lastPageOffset, lastPageResponse.body.list);
      throw new Error('Wrong sort on last page');
    }
  });

  it('Get asc sorted table data list with required columns', async function () {
    const view = (await View.list(customerTable.id))[0]
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response.body.list[0], visibleColumns)) {
      console.log(response.body.list);
      throw new Error('Wrong columns');
    }

    if (response.body.list[0][firstNameColumn.title] !== 'AARON') {
      console.log(response.body.list);
      throw new Error('Wrong sort');
    }

    const lastPageOffset =
      Math.trunc(pageInfo.totalRows / pageInfo.pageSize) * pageInfo.pageSize;
    const lastPageResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
        offset: lastPageOffset,
      })
      .expect(200);

    if (
      lastPageResponse.body.list[lastPageResponse.body.list.length - 1][
        firstNameColumn.title
      ] !== 'ZACHARY'
    ) {
      console.log(lastPageOffset, lastPageResponse.body.list);
      throw new Error('Wrong sort on last page');
    }
  });
}

export default tableTest;