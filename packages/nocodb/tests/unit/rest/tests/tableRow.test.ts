import 'mocha';
import { createProject, createSakilaProject } from './factory/project';
import init from '../init';
import request from 'supertest';
import { ColumnType, UITypes } from 'nocodb-sdk';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
} from './factory/column';
import { createTable, getTable } from './factory/table';
import {
  createRelation,
  createRow,
  generateDefaultRowAttributes,
  getOneRow,
  getRow,
  listRow,
} from './factory/row';
import { isMysql, isSqlite } from '../init/db';
import Model from '../../../../src/lib/models/Model';
import console from 'console';
import Project from '../../../../src/lib/models/Project';

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

  it('Get table data list', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
    const pageInfo = response.body.pageInfo;

    if (response.body.list.length !== pageInfo.pageSize) {
      throw new Error('Wrong number of rows');
    }

    if (!isColumnsCorrectInResponse(response.body.list[0], customerColumns)) {
      throw new Error('Wrong columns');
    }
  });

  it('Get table data list with required columns', async function () {
    const requiredColumns = customerColumns.filter((_, index) => index < 3);

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
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
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
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
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
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

  it('Get sorted table data list with a rollup column', async function () {
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
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
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
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
    const rentalTable = await getTable({project: sakilaProject, name: 'rental'})

    const lookupColumn = await createLookupColumn(context, {
      project: sakilaProject,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
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
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
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

  it('Get filtered table data list with a lookup column', async function () {
    const rentalTable = await getTable({project: sakilaProject, name: 'rental'});

    const lookupColumn = await createLookupColumn(context, {
      project: sakilaProject,
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
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
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

  it('Get filtered table data list with a (hm)lookup column', async function () {
    const lookupColumn = await createLookupColumn(context, {
      project: sakilaProject,
      title: 'Lookup',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const filter = {
      fk_column_id: lookupColumn?.id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'gte',
      value: '2006-02-12 15:30',
    };

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([filter]),
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 158)
      throw new Error('Wrong number of rows');
  });

  it('Get nested sorted filtered table data list with a lookup column', async function () {
    const rentalTable = await getTable({project: sakilaProject, name: 'rental'});

    const lookupColumn = await createLookupColumn(context, {
      project: sakilaProject,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });

    const paymentListColumn = (await rentalTable.getColumns()).find(
      (c) => c.title === 'Payment List'
    );

    const returnDateColumn = (await rentalTable.getColumns()).find(
      (c) => c.title === 'ReturnDate'
    );

    const nestedFilter = {
      is_group: true,
      status: 'create',
      logical_op: 'and',
      children: [
        {
          fk_column_id: lookupColumn?.id,
          status: 'create',
          logical_op: 'and',
          comparison_op: 'like',
          value: '%a%',
        },
        {
          fk_column_id: paymentListColumn?.id,
          status: 'create',
          logical_op: 'and',
          comparison_op: 'notempty',
        },
        {
          is_group: true,
          status: 'create',
          logical_op: 'and',
          children: [
            {
              logical_op: 'and',
              fk_column_id: returnDateColumn?.id,
              status: 'create',
              comparison_op: 'gte',
              value: '2005-06-02 04:33',
            },
          ],
        },
      ],
    };

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 9133)
      throw new Error('Wrong number of rows');

    if (response.body.list[0][lookupColumn.title] !== 'ANDREW')
      throw new Error('Wrong filter');

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: lookupColumn?.id,
            direction: 'asc',
          },
        ]),
      })
      .expect(200);

    if (ascResponse.body.pageInfo.totalRows !== 9133)
      throw new Error('Wrong number of rows');

    if (ascResponse.body.list[0][lookupColumn.title] !== 'AARON') {
      console.log(ascResponse.body.list[0][lookupColumn.title]);
      throw new Error('Wrong filter');
    }

    const descResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: lookupColumn?.id,
            direction: 'desc',
          },
        ]),
      })
      .expect(200);

    if (descResponse.body.pageInfo.totalRows !== 9133)
      throw new Error('Wrong number of rows');

    if (descResponse.body.list[0][lookupColumn.title] !== 'ZACHARY')
      throw new Error('Wrong filter');
  });

  it('Get nested sorted filtered table data list with a rollup column in customer table', async function () {
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const paymentListColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Payment List'
    );

    const activeColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Active'
    );

    const addressColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Address'
    );

    const nestedFilter = [
      {
        fk_column_id: rollupColumn?.id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gte',
        value: '25',
      },
      {
        is_group: true,
        status: 'create',
        logical_op: 'or',
        children: [
          {
            fk_column_id: rollupColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'lte',
            value: '30',
          },
          {
            fk_column_id: paymentListColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'notempty',
          },
          {
            is_group: true,
            status: 'create',
            logical_op: 'and',
            children: [
              {
                logical_op: 'and',
                fk_column_id: activeColumn?.id,
                status: 'create',
                comparison_op: 'notempty',
              },
            ],
          },
        ],
      },
    ];

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 594)
      throw new Error('Wrong number of rows');

    if (response.body.list[0][rollupColumn.title] !== 32)
      throw new Error('Wrong filter');

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: rollupColumn?.id,
            direction: 'asc',
          },
          {
            fk_column_id: addressColumn?.id,
            direction: 'asc',
          },
        ]),
      })
      .expect(200);

    if (ascResponse.body.pageInfo.totalRows !== 594)
      throw new Error('Wrong number of rows');

    if (ascResponse.body.list[0][rollupColumn.title] !== 12) {
      console.log(ascResponse.body.list[0][rollupColumn.title]);
      throw new Error('Wrong filter');
    }

    if (
      ascResponse.body.list[1][addressColumn.title]['Address'] !==
      '1308 Sumy Loop'
    ) {
      console.log(ascResponse.body.list[1]);
      throw new Error('Wrong filter');
    }

    const descResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: rollupColumn?.id,
            direction: 'desc',
          },
          {
            fk_column_id: addressColumn?.id,
            direction: 'desc',
          },
        ]),
      })
      .expect(200);

    if (descResponse.body.pageInfo.totalRows !== 594)
      throw new Error('Wrong number of rows');

    if (descResponse.body.list[0][rollupColumn.title] !== 46)
      throw new Error('Wrong filter');

    if (
      descResponse.body.list[2][addressColumn.title]['Address'] !==
      '1479 Rustenburg Boulevard'
    ) {
      console.log(descResponse.body.list[2]);
      throw new Error('Wrong filter');
    }
  });

  it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table', async function () {
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const paymentListColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Payment List'
    );

    const activeColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Active'
    );

    const nestedFields = {
      'Rental List': ['RentalDate', 'ReturnDate'],
    };

    const nestedFilter = [
      {
        fk_column_id: rollupColumn?.id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gte',
        value: '25',
      },
      {
        is_group: true,
        status: 'create',
        logical_op: 'or',
        children: [
          {
            fk_column_id: rollupColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'lte',
            value: '30',
          },
          {
            fk_column_id: paymentListColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'notempty',
          },
          {
            is_group: true,
            status: 'create',
            logical_op: 'and',
            children: [
              {
                logical_op: 'and',
                fk_column_id: activeColumn?.id,
                status: 'create',
                comparison_op: 'notempty',
              },
            ],
          },
        ],
      },
    ];

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        nested: nestedFields,
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: rollupColumn?.id,
            direction: 'asc',
          },
        ]),
      })
      .expect(200);

    if (ascResponse.body.pageInfo.totalRows !== 594)
      throw new Error('Wrong number of rows');

    if (ascResponse.body.list[0][rollupColumn.title] !== 12) {
      throw new Error('Wrong filter');
    }

    const nestedRentalResponse = Object.keys(
      ascResponse.body.list[0]['Rental List']
    );
    if (
      nestedRentalResponse.includes('RentalId') &&
      nestedRentalResponse.includes('RentalDate') &&
      nestedRentalResponse.length === 2
    ) {
      throw new Error('Wrong nested fields');
    }
  });

  it('Sorted Formula column on rollup customer table', async function () {
    const rollupColumnTitle = 'Number of rentals';
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: rollupColumnTitle,
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const formulaColumnTitle = 'Formula';
    const formulaColumn = await createColumn(context, customerTable, {
      uidt: UITypes.Formula,
      title: formulaColumnTitle,
      formula: `ADD({${rollupColumn.title}}, 10)`,
    });

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .query({
        sortArrJson: JSON.stringify([
          {
            fk_column_id: formulaColumn?.id,
            direction: 'asc',
          },
        ]),
      })
      .expect(200);

    if (response.body.list[0][formulaColumnTitle] !== 22)
      throw new Error('Wrong sorting');

    if (
      (response.body.list as Array<any>).every(
        (row) => row['Formula'] !== row[rollupColumnTitle] + 10
      )
    ) {
      throw new Error('Wrong formula');
    }
  });

  // it('Get nested sorted filtered table with nested fields data list with a formula > lookup > rollup column in customer table', async function () {
  //   const rentalTable = await Model.getByIdOrName({
  //     project_id: sakilaProject.id,
  //     base_id: sakilaProject.bases[0].id,
  //     table_name: 'rental',
  //   });

  //   const rollupColumn = await createRollupColumn(context, {
  //     sakilaProject,
  //     title: 'Number of rentals',
  //     rollupFunction: 'count',
  //     table: customerTable,
  //     relatedTableName: 'rental',
  //     relatedTableColumnTitle: 'RentalDate',
  //   });

  //   const lookupColumn = await createLookupColumn(context, {
  //     sakilaProject,
  //     title: 'Lookup',
  //     table: rentalTable,
  //     relatedTableName: customerTable.table_name,
  //     relatedTableColumnTitle: rollupColumn.title,
  //   });

  //   const formulaColumn = await createColumn(context, rentalTable, {
  //     uidt: UITypes.Formula,
  //     title: 'Formula',
  //     formula: `ADD({${lookupColumn.title}}, 10)`,
  //   });
  //   console.log(formulaColumn);

  //   const response = await request(context.app)
  //     .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
  //     .set('xc-auth', context.token)
  //     .query({
  //       sortArrJson: JSON.stringify([
  //         {
  //           fk_column_id: formulaColumn?.id,
  //           direction: 'asc',
  //         },
  //       ]),
  //     })
  //     .expect(200);

  //   console.log(response.body);
  // });

  it('Create table row', async function () {
    const table = await createTable(context, project);

    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(200);

    const row = response.body;
    if (row['Title'] !== 'Test') throw new Error('Wrong row title');
  });

  it('Create table row with wrong table id', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${project.id}/wrong-table-id`)
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(404);

    if (response.body.msg !== 'Table not found')
      throw new Error('Wrong error message');
  });

  it('Find one sorted table data list with required columns', async function () {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];

    let response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/find-one`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: '-FirstName',
      })
      .expect(200);

    if (!isColumnsCorrectInResponse(response.body, visibleColumns)) {
      console.log(response.body.list);
      throw new Error('Wrong columns');
    }

    if (response.body[firstNameColumn.title] !== 'ZACHARY') {
      console.log(response.body);
      throw new Error('Wrong sort');
    }

    response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/find-one`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: 'FirstName',
      })
      .expect(200);

    if (!isColumnsCorrectInResponse(response.body, visibleColumns)) {
      console.log(response.body.list);
      throw new Error('Wrong columns');
    }

    if (response.body[firstNameColumn.title] !== 'AARON') {
      console.log(response.body);
      throw new Error('Wrong sort');
    }
  });

  it('Find one desc sorted and with rollup table data  list with required columns', async function () {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );

    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Rollup',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const visibleColumns = [firstNameColumn];
    const sortInfo = `-FirstName, +${rollupColumn.title}`;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/find-one`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
      })
      .expect(200);

    if (!isColumnsCorrectInResponse(response.body, visibleColumns)) {
      console.log(response.body.list);
      throw new Error('Wrong columns');
    }

    if (response.body[firstNameColumn.title] !== 'ZACHARY') {
      console.log(response.body);
      throw new Error('Wrong sort');
    }
  });

  it('Find one sorted filtered table with nested fields data list with a rollup column in customer table', async function () {
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const paymentListColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Payment List'
    );

    const activeColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Active'
    );

    const nestedFields = {
      'Rental List': ['RentalDate', 'ReturnDate'],
    };

    const nestedFilter = [
      {
        fk_column_id: rollupColumn?.id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gte',
        value: '25',
      },
      {
        is_group: true,
        status: 'create',
        logical_op: 'or',
        children: [
          {
            fk_column_id: rollupColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'lte',
            value: '30',
          },
          {
            fk_column_id: paymentListColumn?.id,
            status: 'create',
            logical_op: 'and',
            comparison_op: 'notempty',
          },
          {
            is_group: true,
            status: 'create',
            logical_op: 'and',
            children: [
              {
                logical_op: 'and',
                fk_column_id: activeColumn?.id,
                status: 'create',
                comparison_op: 'notempty',
              },
            ],
          },
        ],
      },
    ];

    const ascResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/find-one`
      )
      .set('xc-auth', context.token)
      .query({
        nested: nestedFields,
        filterArrJson: JSON.stringify([nestedFilter]),
        sort: `${rollupColumn.title}`,
      })
      .expect(200);

    if (ascResponse.body[rollupColumn.title] !== 12) {
      console.log(ascResponse.body);
      throw new Error('Wrong filter');
    }

    const nestedRentalResponse = Object.keys(ascResponse.body['Rental List']);
    if (
      nestedRentalResponse.includes('RentalId') &&
      nestedRentalResponse.includes('RentalDate') &&
      nestedRentalResponse.length === 2
    ) {
      throw new Error('Wrong nested fields');
    }
  });

  it('Groupby desc sorted and with rollup table data  list with required columns', async function () {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );

    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Rollup',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const visibleColumns = [firstNameColumn];
    const sortInfo = `-FirstName, +${rollupColumn.title}`;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/groupby`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
        column_name: firstNameColumn.column_name,
      })
      .expect(200);

    if (
      response.body.list[4]['first_name'] !== 'WILLIE' ||
      response.body.list[4]['count'] !== 2
    )
      throw new Error('Wrong groupby');
  });

  it('Groupby desc sorted and with rollup table data  list with required columns', async function () {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );

    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Rollup',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const visibleColumns = [firstNameColumn];
    const sortInfo = `-FirstName, +${rollupColumn.title}`;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/groupby`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
        column_name: firstNameColumn.column_name,
        offset: 4,
      })
      .expect(200);

    if (
      response.body.list[0]['first_name'] !== 'WILLIE' ||
      response.body.list[0]['count'] !== 2
    )
      throw new Error('Wrong groupby');
  });

  it('Read table row', async function () {
    const listResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const row = listResponse.body.list[0];

    const readResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${row['CustomerId']}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      row['CustomerId'] !== readResponse.body['CustomerId'] ||
      row['FirstName'] !== readResponse.body['FirstName']
    ) {
      throw new Error('Wrong read');
    }
  });

  it('Update table row', async function () {
    const table = await createTable(context, project);
    const row = await createRow(context, { project, table });

    const updateResponse = await request(context.app)
      .patch(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .send({
        title: 'Updated',
      })
      .expect(200);

    if (updateResponse.body['Title'] !== 'Updated') {
      throw new Error('Wrong update');
    }
  });

  it('Update table row with validation and invalid data', async function () {
    const table = await createTable(context, project);
    const emailColumn = await createColumn(context, table, {
      title: 'Email',
      column_name: 'email',
      uidt: UITypes.Email,
      meta: {
        validate: true,
      },
    });
    const row = await createRow(context, { project, table });

    await request(context.app)
      .patch(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .send({
        [emailColumn.column_name]: 'invalidemail',
      })
      .expect(400);
  });

  // todo: Test webhooks of before and after update
  // todo: Test with form view

  it('Update table row with validation and valid data', async function () {
    const table = await createTable(context, project);
    const emailColumn = await createColumn(context, table, {
      title: 'Email',
      column_name: 'email',
      uidt: UITypes.Email,
      meta: {
        validate: true,
      },
    });
    const row = await createRow(context, { project, table });

    const response = await request(context.app)
      .patch(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .send({
        [emailColumn.column_name]: 'valid@example.com',
      })
      .expect(200);

    const updatedRow = await getRow(
      context,
      {project,
      table,
      id: response.body['Id']}
    );
    if (updatedRow[emailColumn.title] !== 'valid@example.com') {
      throw new Error('Wrong update');
    }
  });

  it('Delete table row', async function () {
    const table = await createTable(context, project);
    const row = await createRow(context, { project, table });

    await request(context.app)
      .delete(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, {project, table, id: row['Id']});
    if (deleteRow && Object.keys(deleteRow).length > 0) {
      console.log(deleteRow);
      throw new Error('Wrong delete');
    }
  });

  it('Delete table row', async function () {
    const table = await createTable(context, project);
    const row = await createRow(context, { project, table });

    await request(context.app)
      .delete(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, {project, table, id: row['Id']});
    if (deleteRow && Object.keys(deleteRow).length > 0) {
      console.log(deleteRow);
      throw new Error('Wrong delete');
    }
  });

  it('Delete table row with foreign key contraint', async function () {
    const table = await createTable(context, project);
    const relatedTable = await createTable(context, project, {
      table_name: 'Table2',
      title: 'Table2_Title',
    });
    const ltarColumn = await createLtarColumn(context, {
      title: 'Ltar',
      parentTable: table,
      childTable: relatedTable,
      type: 'hm',
    });

    const row = await createRow(context, { project, table });

    await createRelation(context, {
      project,
      table,
      childTable: relatedTable,
      column: ltarColumn,
      type: 'hm',
      rowId: row['Id'],
    });

    const response = await request(context.app)
      .delete(`/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}`)
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, {project, table, id: row['Id']});
    if (!deleteRow) {
      throw new Error('Should not delete');
    }

    if (
      !(response.body.message[0] as string).includes(
        'is a LinkToAnotherRecord of'
      )
    ) {
      throw new Error('Should give ltar foreign key error');
    }
  });

  it('Exist should be true table row when it exists', async function () {
    const row = await getOneRow(context, {
      project: sakilaProject,
      table: customerTable,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${row['CustomerId']}/exist`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (!response.body) {
      throw new Error('Should exist');
    }
  });

  it('Exist should be false table row when it does not exists', async function () {
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/invalid-id/exist`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body) {
      throw new Error('Should not exist');
    }
  });

  it('Bulk insert', async function () {
    const table = await createTable(context, project);
    const columns = await table.getColumns();

    const rowAttributes = Array(99)
      .fill(0)
      .map((index) => generateDefaultRowAttributes({ columns, index }));

    const response = await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send(rowAttributes)
      .expect(200);

    const rows = await listRow({ project, table });
    console.log(rows.length);
    // Mysql will not return the batched inserted rows
    if (!isMysql(context)) {
      if (
        !isSqlite(context) &&
        response.body.length !== rowAttributes.length &&
        rows.length !== rowAttributes.length
      ) {
        throw new Error('Wrong number of rows inserted');
      }

      // Max 10 rows will be inserted in sqlite
      if (isSqlite(context) && response.body.length !== 10) {
        throw new Error('Wrong number of rows inserted');
      }
    } else {
      if (rows.length !== rowAttributes.length) {
        throw new Error('Wrong number of rows inserted');
      }
    }
  });

  it('Bulk insert 400 records', async function () {
    const table = await createTable(context, project);
    const columns = await table.getColumns();

    const rowAttributes = Array(400)
      .fill(0)
      .map((index) => generateDefaultRowAttributes({ columns, index }));

    const response = await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send(rowAttributes)
      .expect(200);

    const rows = await listRow({ project, table });

    // Mysql will not return the batched inserted rows
    if (!isMysql(context)) {
      if (
        !isSqlite(context) &&
        response.body.length !== rowAttributes.length &&
        rows.length !== rowAttributes.length
      ) {
        throw new Error('Wrong number of rows inserted');
      }

      // Max 10 rows will be inserted in sqlite
      if (isSqlite(context) && response.body.length !== 10) {
        throw new Error('Wrong number of rows inserted');
      }
    } else {
      if (rows.length !== rowAttributes.length) {
        throw new Error('Wrong number of rows inserted');
      }
    }
  });

  it('Bulk update', async function () {
    const table = await createTable(context, project);

    const arr = Array(120)
      .fill(0)
      .map((_, index) => index);
    for (const index of arr) {
      await createRow(context, { project, table, index });
    }

    const rows = await listRow({ project, table });

    await request(context.app)
      .patch(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send(
        rows.map((row) => ({ title: `new-${row['Title']}`, id: row['Id'] }))
      )
      .expect(200);

    const updatedRows: Array<any> = await listRow({ project, table });
    if (!updatedRows.every((row) => row['Title'].startsWith('new-'))) {
      throw new Error('Wrong number of rows updated');
    }
  });

  it('Bulk delete', async function () {
    const table = await createTable(context, project);

    const arr = Array(120)
      .fill(0)
      .map((_, index) => index);
    for (const index of arr) {
      await createRow(context, { project, table, index });
    }

    const rows = await listRow({ project, table });

    await request(context.app)
      .delete(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .send(rows.map((row) => ({ id: row['Id'] })))
      .expect(200);

    const updatedRows: Array<any> = await listRow({ project, table });
    if (updatedRows.length !== 0) {
      throw new Error('Wrong number of rows delete');
    }
  });

  // todo: add test for bulk delete with ltar but need filterArrJson. filterArrJson not now supported with this api.
  // it.only('Bulk update nested filtered table data list with a lookup column', async function () {
  // });

  it('Export csv', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/export/csv`)
      .set('xc-auth', context.token)
      .expect(200);

    if(!response['header']['content-disposition'].includes("Customer-export.csv")){
      throw new Error('Wrong file name');
    }
    if(!response.text){
      throw new Error('Wrong export');
    }
  })

  it('Export excel', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/export/excel`)
      .set('xc-auth', context.token)
      .expect(200);

    if(!response['header']['content-disposition'].includes("Customer-export.xlsx")){
      throw new Error('Wrong file name');
    }
    if(!response.text){
      throw new Error('Wrong export');
    }
  })

  // todo: Add export test for views

  it('Nested row list hm', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body['pageInfo']
    if(pageInfo['totalRows'] !== 32 ||  pageInfo['pageSize'] !== 25) {
      console.log(pageInfo)
      throw new Error('Wrong total rows');
    }
  })

  it('Nested row list hm with limit and offset', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`)
      .set('xc-auth', context.token)
      .query({
        limit: 30,
        offset: 10
      })
      .expect(200);

    const pageInfo = response.body['pageInfo']
    if(pageInfo['totalRows'] !== 32 ||  pageInfo['pageSize'] !== 30 || response.body.list.length !== 22) {
      throw new Error('Wrong total rows');
    }
  })

  it('Row list hm with invalid table id', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/wrong-id/${rowId}/hm/${rentalListColumn.id}`)
      .set('xc-auth', context.token)
      .expect(404);

    if(response.body['msg'] !== 'Table not found') {
      throw new Error('Wrong error message');
    }
  })

  // todo: Api does not support fields and sort 
  // it.only('Nested row list hm with selected fields', async () => {
  //   const rowId = 1;

  //   const firstNameColumn = customerColumns.find(
  //     (col) => col.title === 'FirstName'
  //   );
  //   const visibleColumns = [firstNameColumn];

  //   const rentalListColumn = (await customerTable.getColumns()).find(
  //     (column) => column.title === 'Rental List'
  //   )!;
  //   const response = await request(context.app)
  //     .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`)
  //     .query({
  //       fields: visibleColumns.map((c) => c.title),
  //     })
  //     .set('xc-auth', context.token)

  //   const pageInfo = response.body['pageInfo']
  //   if(pageInfo['totalRows'] !== 32) {
  //     throw new Error('Wrong total rows');
  //   }

  //   if (!isColumnsCorrectInResponse(response.body.list[0], visibleColumns)) {
  //     console.log(response.body.list);
  //     throw new Error('Wrong columns');
  //   }
  // })

  it('Nested row list mm', async () => {
    const rowId = 1;
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const filmTable = await getTable({project: sakilaProject, name: 'film'});
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body['pageInfo']
    if(pageInfo['totalRows'] !== 19 ||  pageInfo['pageSize'] !== 25) {
      console.log(pageInfo)
      throw new Error('Wrong total rows');
    }
  })

  it('Nested row list mm with limit and offset', async () => {
    const rowId = 1;
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const filmTable = await getTable({project: sakilaProject, name: 'film'});
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`)
      .set('xc-auth', context.token)
      .query({
        limit: 30,
        offset: 10
      })
      .expect(200);

    const pageInfo = response.body['pageInfo']
    if(pageInfo['totalRows'] !== 19 ||  pageInfo['pageSize'] !== 30 || response.body.list.length !== 9) {
      console.log(pageInfo, response.body.list.length)
      throw new Error('Wrong total rows');
    }
  })

  it('Row list mm with invalid table id', async () => {
    const rowId = 1
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/mm/${filmListColumn.id}`)
      .set('xc-auth', context.token)
      .expect(404);

    if(response.body['msg'] !== 'Table not found') {
      console.log(response.body)
      throw new Error('Wrong error message');
    }
  })

  it('Create hm relation with invalid table id', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const refId = 1;
    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/hm/${rentalListColumn.id}/${refId}`)
      .set('xc-auth', context.token)
      .expect(404);
      global.touchedSakilaDb = true;

    if(response.body['msg'] !== 'Table not found') {
      throw new Error('Wrong error message');
    }
  })

  it('Create list hm wrong column id', async () => {
    const rowId = 1;
    const refId = 1;

    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/invalid-column/${refId}`)
      .set('xc-auth', context.token)
      .expect(404);
    global.touchedSakilaDb = true;

    if(response.body.msg !== "Column with id/name 'invalid-column' is not found") {
      console.log(response.body)
      throw new Error('Should error out');
    }
  })

  // todo: mm create api does not error out in the case of existing ref row id
  // it.only('Create list mm existing ref row id', async () => {
  //   const rowId = 1;
  //   const rentalListColumn = (await customerTable.getColumns()).find(
  //     (column) => column.title === 'Rental List'
  //   )!;
  //   const refId = 1;

  //   await request(context.app)
  //     .post(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/${refId}`)
  //     .set('xc-auth', context.token)
  //     .expect(400)
      

  //     await request(context.app)
  //     .post(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/${refId}`)
  //     .set('xc-auth', context.token)
  //     .expect(400)
  // })

  it('Create list hm', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const refId = 1;

    const lisResponseBeforeUpdate = await request(context.app)
    .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`)
    .set('xc-auth', context.token)
    .expect(200);

    await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/${refId}`)
      .set('xc-auth', context.token)
      .expect(200);
      global.touchedSakilaDb = true;

    const lisResponseAfterUpdate = await request(context.app)
    .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`)
    .set('xc-auth', context.token)
    .expect(200);
    
    if(lisResponseAfterUpdate.body.pageInfo.totalRows !== lisResponseBeforeUpdate.body.pageInfo.totalRows + 1) {
      throw new Error('Wrong list length');
    }
  })

  it('Create list mm wrong column id', async () => {
    const rowId = 1;
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const refId = 1;

    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/invalid-column/${refId}`)
      .set('xc-auth', context.token)
      .expect(404);
      global.touchedSakilaDb = true;

    if(response.body.msg !== "Column with id/name 'invalid-column' is not found") {
      console.log(response.body)
      throw new Error('Should error out');
    }
  })

  it('Create list mm existing ref row id', async () => {
    const rowId = 1;
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const refId = 1;

    await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/${refId}`)
      .set('xc-auth', context.token)
      .expect(400);
      global.touchedSakilaDb = true;
  })

  it('Create list mm', async () => {
    const rowId = 1;
    const actorTable = await getTable({project: sakilaProject, name: 'actor'});
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const refId = 2;

    const lisResponseBeforeUpdate = await request(context.app)
    .get(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`)
    .set('xc-auth', context.token)
    .expect(200);

    await request(context.app)
      .post(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/${refId}`)
      .set('xc-auth', context.token)
      .expect(200);
    global.touchedSakilaDb = true;

    const lisResponseAfterUpdate = await request(context.app)
    .get(`/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`)
    .set('xc-auth', context.token)
    .expect(200);
    
    if(lisResponseAfterUpdate.body.pageInfo.totalRows !== lisResponseBeforeUpdate.body.pageInfo.totalRows + 1) {
      throw new Error('Wrong list length');
    }
  })
}

export default function () {
  describe('TableRow', tableTest);
}
