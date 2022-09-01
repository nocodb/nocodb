import 'mocha';
import { createSakilaProject } from './helpers/project';
import Model from '../../../../lib/models/Model';
import init from '../init';
import request from 'supertest';
import { ColumnType } from 'nocodb-sdk';
import { createLookupColumn, createRollupColumn } from './helpers/column';
import Filter from '../../../../lib/models/Filter';

const isColumnsCorrectInResponse = (response, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(response.body.list[0])
    .sort()
    .join(',');
  const customerColumnsListStr = columns
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === customerColumnsListStr;
};

function tableTest() {
  let context;
  let project;
  let customerTable: Model;
  let customerColumns;

  beforeEach(async function () {
    context = await init();

    project = await createSakilaProject(context);

    customerTable = await Model.getByIdOrName({
      project_id: project.id,
      base_id: project.bases[0].id,
      table_name: 'customer',
    });
    customerColumns = await customerTable.getColumns();
  });

  it('Get table data list', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response, customerColumns)) {
      throw new Error('Wrong columns');
    }
  });

  it('Get table data list with required columns', async function () {
    const requiredColumns = customerColumns.filter((_, index) => index < 3);

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        fields: requiredColumns.map((c) => c.title),
      })
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response, requiredColumns)) {
      throw new Error('Wrong columns');
    }
  });

  it('Get desc sorted table data list with required columns', async function () {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
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

    if (!isColumnsCorrectInResponse(response, visibleColumns)) {
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
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
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
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
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

    if (!isColumnsCorrectInResponse(response, visibleColumns)) {
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
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
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

  it('Get sorted table data list with a rollup column', async function () {
    const rollupColumn = await createRollupColumn(context, {
      project,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        sortArrJson: JSON.stringify([
          { fk_column_id: rollupColumn?.id, direction: 'asc' },
        ]),
      })
      .expect(200);
    if (ascResponse.body.list[0]['FirstName'] !== 'BRIAN')
      throw new Error('Wrong sort');

    const descResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        sortArrJson: JSON.stringify([
          { fk_column_id: rollupColumn?.id, direction: 'desc' },
        ]),
      })
      .expect(200);
    if (descResponse.body.list[0]['FirstName'] !== 'ELEANOR')
      throw new Error('Wrong sort');
  });

  it('Get sorted table data list with a lookup column', async function () {
    const rentalTable = await Model.getByIdOrName({
      project_id: project.id,
      base_id: project.bases[0].id,
      table_name: 'rental',
    });

    const lookupColumn = await createLookupColumn(context, {
      project,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        sortArrJson: JSON.stringify([
          { fk_column_id: lookupColumn?.id, direction: 'asc' },
        ]),
      })
      .expect(200);

    if (ascResponse.body.list[0][lookupColumn.title] !== 'AARON')
      throw new Error('Wrong sort');

    const descResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        sortArrJson: JSON.stringify([
          { fk_column_id: lookupColumn?.id, direction: 'desc' },
        ]),
      })
      .expect(200);
    if (descResponse.body.list[0][lookupColumn.title] !== 'ZACHARY')
      throw new Error('Wrong sort');
  });

  it('Get sorted filtered table data list with a lookup column', async function () {
    const rentalTable = await Model.getByIdOrName({
      project_id: project.id,
      base_id: project.bases[0].id,
      table_name: 'rental',
    });

    const lookupColumn = await createLookupColumn(context, {
      project,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });

    const filter = {
      fk_column_id: lookupColumn?.id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'AARON',
    };

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([filter]),
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 24)
      throw new Error('Wrong number of rows');

    response.body.list.forEach((row) => {
      if (row[lookupColumn.title] !== 'AARON') throw new Error('Wrong filter');
    });
  });
}

export default function () {
  describe('TableRow', tableTest);
}
