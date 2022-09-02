import 'mocha';
import { createProject, createSakilaProject } from './factory/project';
import Model from '../../../../lib/models/Model';
import init from '../init';
import request from 'supertest';
import { ColumnType, UITypes } from 'nocodb-sdk';
import {
  createColumn,
  createLookupColumn,
  createRollupColumn,
} from './factory/column';
import { createTable } from './factory/table';

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
  let project;
  let sakilaProject;
  let customerTable: Model;
  let customerColumns;

  beforeEach(async function () {
    context = await init();

    sakilaProject = await createSakilaProject(context);
    project = await createProject(context);

    customerTable = await Model.getByIdOrName({
      project_id: sakilaProject.id,
      base_id: sakilaProject.bases[0].id,
      table_name: 'customer',
    });
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
    const rentalTable = await Model.getByIdOrName({
      project_id: sakilaProject.id,
      base_id: sakilaProject.bases[0].id,
      table_name: 'rental',
    });

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
    const rentalTable = await Model.getByIdOrName({
      project_id: sakilaProject.id,
      base_id: sakilaProject.bases[0].id,
      table_name: 'rental',
    });

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
    const rentalTable = await Model.getByIdOrName({
      project_id: sakilaProject.id,
      base_id: sakilaProject.bases[0].id,
      table_name: 'rental',
    });

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
}

export default function () {
  describe('TableRow', tableTest);
}
