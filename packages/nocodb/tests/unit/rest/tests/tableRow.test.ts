import 'mocha';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/project';
import request from 'supertest';
import { ColumnType, UITypes } from 'nocodb-sdk';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
} from '../../factory/column';
import { createTable, getTable } from '../../factory/table';
import {
  createChildRow,
  createRow,
  generateDefaultRowAttributes,
  getOneRow,
  getRow,
  listRow,
  createBulkRows,
} from '../../factory/row';
import { isMysql, isPg, isSqlite } from '../../init/db';
import Model from '../../../../src/lib/models/Model';
import Project from '../../../../src/lib/models/Project';
import { expect } from 'chai';

const isColumnsCorrectInResponse = (row, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const customerColumnsListStr = columns
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === customerColumnsListStr;
};

// Test case list
// 1. Get table data list
// 2. Get table data list with required columns
// 3. Get desc sorted table data list with required columns
// 4. Get asc sorted table data list with required columns
// 5. Get sorted table data list with a rollup column
// 6. Get sorted table data list with a lookup column
// 7. Get filtered table data list with a lookup column
// 8. Get filtered table data list with a (hm)lookup column
// 9. Get nested sorted filtered table data list with a lookup column
// 10. Get nested sorted filtered table data list with a lookup column with date comparison
// 11. Get nested sorted filtered table data list with a rollup column in customer table
// 12. Get nested sorted filtered table with nested fields data list with a rollup column in customer table
// 13. Sorted Formula column on rollup customer table
// 14. Create table row
// 15. Create table row with wrong table id
// 16. Find one sorted table data list with required columns
// 17. Find one desc sorted and with rollup table data  list with required columns
// 18. Find one sorted filtered table with nested fields data list with a rollup column in customer table
// 19. Groupby desc sorted and with rollup table data  list with required columns
// 20. Groupby desc sorted and with rollup table data  list with required columns
// 21. Read table row
// 22. Update table row
// 23. Update table row with validation and invalid data
// 24. Update table row with validation and valid data
// 25. Delete table row
// 26. Delete table row with foreign key contraint
// 27. Exist should be true table row when it exists
// 28. Exist should be false table row when it does not exists
// 29. Bulk insert
// 30. Bulk insert 400 records
// 31. Bulk update
// 32. Bulk delete
// 33. Export csv
// 34. Export excel
// 35. Nested row list hm
// 36. Nested row list hm with limit and offset
// 37. Row list hm with invalid table id
// 38. Nested row list mm
// 39. Nested row list mm with limit and offset
// 40. Row list mm with invalid table id
// 41. Create hm relation with invalid table id
// 42. Create hm relation with non ltar column
// 43. Create list hm wrong column id
// 44. Create list hm
// 45. Create list mm wrong column id
// 46. Create mm relation with non ltar column
// 47. Create list mm existing ref row id
// 48. Create list mm
// 49. List hm with non ltar column
// 50. List mm with non ltar column
// 51. Delete mm existing ref row id
// 52. Delete list hm with existing ref row id with non nullable clause
// 53. Delete list hm with existing ref row id
// 54. Exclude list hm
// 55. Exclude list hm with limit and offset
// 56. Exclude list mm
// 57. Exclude list mm with offset
// 58. Exclude list bt
// 59. Exclude list bt with offset
// 60. Create nested hm relation with invalid table id
// 61. Create nested mm relation with invalid table id
// 62. Get grouped data list

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

    customerTable = await getTable({
      project: sakilaProject,
      name: 'customer',
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
      console.log(response.body.pageInfo);
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
      console.log(response.body.pageInfo);
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
      console.log(response.body.pageInfo);
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
      console.log(response.body.pageInfo);
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
    const rentalTable = await getTable({
      project: sakilaProject,
      name: 'rental',
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
    const rentalTable = await getTable({
      project: sakilaProject,
      name: 'rental',
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

    if (response.body.pageInfo.totalRows !== 24) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

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

    if (response.body.pageInfo.totalRows !== 158) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }
  });

  it('Get nested sorted filtered table data list with a lookup column', async function () {
    const rentalTable = await getTable({
      project: sakilaProject,
      name: 'rental',
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
      ],
    };

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      })
      .expect(200);

    expect(response.body.pageInfo.totalRows).equal(9558);

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

    expect(ascResponse.body.pageInfo.totalRows).equal(9558);
    expect(ascResponse.body.list[0][lookupColumn.title]).equal('AARON');

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

    expect(descResponse.body.pageInfo.totalRows).equal(9558);
    expect(descResponse.body.list[0][lookupColumn.title]).equal('ZACHARY');
  });

  it('Get nested sorted filtered table data list with a lookup column with date comparison', async function () {
    // Since sqlite doesn't support date comparison
    if (isSqlite(context)) return;
    const rentalTable = await getTable({
      project: sakilaProject,
      name: 'rental',
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

    if (parseInt(response.body.pageInfo.totalRows) !== 9133) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

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

    if (parseInt(ascResponse.body.pageInfo.totalRows) !== 9133) {
      console.log(ascResponse.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

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

    if (parseInt(descResponse.body.pageInfo.totalRows) !== 9133) {
      console.log(descResponse.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (descResponse.body.list[0][lookupColumn.title] !== 'ZACHARY')
      throw new Error('Wrong filter');
  });

  it('Get nested sorted filtered table data list with a rollup column in customer table', async function () {
    if (isPg(context)) return;
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
        value: 25,
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
            value: 30,
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
                comparison_op: 'checked',
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

    if (parseInt(response.body.pageInfo.totalRows) !== 594) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (parseInt(response.body.list[0][rollupColumn.title]) !== 32) {
      console.log(response.body.list[0]);
      throw new Error('Wrong filter response 0');
    }

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

    if (parseInt(ascResponse.body.pageInfo.totalRows) !== 594) {
      console.log(ascResponse.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (parseInt(ascResponse.body.list[0][rollupColumn.title]) !== 12) {
      console.log(ascResponse.body.list[0][rollupColumn.title]);
      throw new Error('Wrong filter ascResponse 0');
    }

    if (
      ascResponse.body.list[1][addressColumn.title]['Address'] !==
      '1308 Sumy Loop'
    ) {
      console.log(ascResponse.body.list[1]);
      throw new Error('Wrong filter ascResponse 1');
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

    if (parseInt(descResponse.body.pageInfo.totalRows) !== 594) {
      console.log(descResponse.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (parseInt(descResponse.body.list[0][rollupColumn.title]) !== 46) {
      console.log(descResponse.body.list[0]);
      throw new Error('Wrong filter descResponse 0');
    }

    if (
      descResponse.body.list[2][addressColumn.title]['Address'] !==
      '1479 Rustenburg Boulevard'
    ) {
      console.log(descResponse.body.list[2]);
      throw new Error('Wrong filter descResponse 2');
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
      'Rental List': { fields: ['RentalDate', 'ReturnDate'] },
    };

    const nestedFilter = [
      {
        fk_column_id: rollupColumn?.id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gte',
        value: 25,
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
            value: 30,
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
                comparison_op: 'eq',
                value: 1,
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

    if (ascResponse.body.pageInfo.totalRows !== 594) {
      console.log(ascResponse.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (parseInt(ascResponse.body.list[0][rollupColumn.title]) !== 12) {
      throw new Error('Wrong filter');
    }

    const nestedRentalResponse = Object.keys(
      ascResponse.body.list[0]['Rental List']
    );
    if (
      nestedRentalResponse.includes('ReturnDate') &&
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

    if (parseInt(response.body.list[0][formulaColumnTitle]) !== 22)
      throw new Error('Wrong sorting');

    if (
      (response.body.list as Array<any>).every(
        (row) =>
          parseInt(row['Formula']) !== parseInt(row[rollupColumnTitle]) + 10
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
        value: 25,
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
            value: 30,
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
                comparison_op: 'eq',
                value: 1,
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

    if (parseInt(ascResponse.body[rollupColumn.title]) !== 12) {
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
      parseInt(response.body.list[4]['count']) !== 2
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
      parseInt(response.body.list[0]['count']) !== 2
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

    const updatedRow = await getRow(context, {
      project,
      table,
      id: response.body['Id'],
    });
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

    const deleteRow = await getRow(context, { project, table, id: row['Id'] });
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

    await createChildRow(context, {
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

    const deleteRow = await getRow(context, { project, table, id: row['Id'] });
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/998546/exist`
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
      if (isSqlite(context) && rows.length !== rowAttributes.length) {
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
      if (isSqlite(context) && rows.length !== rowAttributes.length) {
        console.log(response.body);
        throw new Error('Wrong number of rows inserted');
      }
    } else {
      if (rows.length !== rowAttributes.length) {
        throw new Error('Wrong number of rows inserted');
      }
    }
  });

  it('Bulk update', async function () {
    // todo: Since sqlite doesn't support multiple sql connections, we can't test bulk update in sqlite
    if (isSqlite(context)) {
      return;
    }
    const table = await createTable(context, project);
    const columns = await table.getColumns();

    const rowAttributes = Array(400)
      .fill(0)
      .map((index) => generateDefaultRowAttributes({ columns, index }));

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });

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
    const columns = await table.getColumns();

    const rowAttributes = Array(400)
      .fill(0)
      .map((index) => generateDefaultRowAttributes({ columns, index }));

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });

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

  // todo: Integrate filterArrJson with bulk delete all and update all
  // it.only('Bulk delete all with condition', async function () {
  //   const table = await createTable(context, project);
  //   const columns = await table.getColumns();
  //   const idColumn = columns.find((column) => column.title === 'Id')!;

  //   const arr = Array(120)
  //     .fill(0)
  //     .map((_, index) => index);
  //   for (const index of arr) {
  //     await createRow(context, { project, table, index });
  //   }

  //   const rows = await listRow({ project, table });

  //   await request(context.app)
  //     .delete(`/api/v1/db/data/bulk/noco/${project.id}/${table.id}/all`)
  //     .set('xc-auth', context.token)
  //     .query({ filterArr: [
  //       {
  //         logical_op: 'and',
  //         fk_column_id: idColumn.id,
  //         comparison_op: 'lt',
  //         value: 20,
  //       }
  //     ]})
  //     .send(rows.map((row) => ({ id: row['Id'] })))
  //     .expect(200);

  //   const updatedRows: Array<any> = await listRow({ project, table });
  //   if (updatedRows.length !== 0) {
  //     console.log(updatedRows.length)
  //     throw new Error('Wrong number of rows delete');
  //   }
  // });

  // todo: add test for bulk delete with ltar but need filterArrJson. filterArrJson not now supported with this api.
  // it.only('Bulk update nested filtered table data list with a lookup column', async function () {
  // });

  // todo: Test contents of file
  it('Export csv', async () => {
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/export/csv`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      !response['header']['content-disposition'].includes('Customer-export.csv')
    ) {
      throw new Error('Wrong file name');
    }
    if (!response.text) {
      throw new Error('Wrong export');
    }
  });

  // todo: Test contents of file
  it('Export excel', async () => {
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/export/excel`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      !response['header']['content-disposition'].includes(
        'Customer-export.xlsx'
      )
    ) {
      throw new Error('Wrong file name');
    }
    if (!response.text) {
      throw new Error('Wrong export');
    }
  });

  // todo: Add export test for views

  it('Nested row list hm', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body['pageInfo'];
    if (pageInfo['totalRows'] !== 32 || pageInfo['pageSize'] !== 25) {
      console.log(pageInfo);
      throw new Error('Wrong total rows');
    }
  });

  it('Nested row list hm with limit and offset', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`
      )
      .set('xc-auth', context.token)
      .query({
        limit: 30,
        offset: 10,
      })
      .expect(200);

    const pageInfo = response.body['pageInfo'];
    if (
      pageInfo['totalRows'] !== 32 ||
      pageInfo['pageSize'] !== 30 ||
      response.body.list.length !== 22
    ) {
      throw new Error('Wrong total rows');
    }
  });

  it('Row list hm with invalid table id', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/wrong-id/${rowId}/hm/${rentalListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Table not found') {
      throw new Error('Wrong error message');
    }
  });

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
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmTable = await getTable({ project: sakilaProject, name: 'film' });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body['pageInfo'];
    if (pageInfo['totalRows'] !== 19 || pageInfo['pageSize'] !== 25) {
      console.log(pageInfo);
      throw new Error('Wrong total rows');
    }
  });

  it('Nested row list mm with limit and offset', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmTable = await getTable({ project: sakilaProject, name: 'film' });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .query({
        limit: 30,
        offset: 10,
      })
      .expect(200);

    const pageInfo = response.body['pageInfo'];
    if (
      pageInfo['totalRows'] !== 19 ||
      pageInfo['pageSize'] !== 30 ||
      response.body.list.length !== 9
    ) {
      console.log(pageInfo, response.body.list.length);
      throw new Error('Wrong total rows');
    }
  });

  it('Row list mm with invalid table id', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Table not found') {
      console.log(response.body);
      throw new Error('Wrong error message');
    }
  });

  it('Create hm relation with invalid table id', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const refId = 1;
    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/hm/${rentalListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Table not found') {
      throw new Error('Wrong error message');
    }
  });

  it('Create hm relation with non ltar column', async () => {
    const rowId = 1;
    const firstNameColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'FirstName'
    )!;
    const refId = 1;
    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${firstNameColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Column not found') {
      console.log(response.body);
      throw new Error('Wrong error message');
    }
  });

  it('Create list hm wrong column id', async () => {
    const rowId = 1;
    const refId = 1;

    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/invalid-column/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (
      response.body.msg !== "Column with id/name 'invalid-column' is not found"
    ) {
      console.log(response.body);
      throw new Error('Should error out');
    }
  });

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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(200);
    global.touchedSakilaDb = true;

    const lisResponseAfterUpdate = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      lisResponseAfterUpdate.body.pageInfo.totalRows !==
      lisResponseBeforeUpdate.body.pageInfo.totalRows + 1
    ) {
      throw new Error('Wrong list length');
    }
  });

  it('Create list mm wrong column id', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const refId = 1;

    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/invalid-column/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (
      response.body.msg !== "Column with id/name 'invalid-column' is not found"
    ) {
      console.log(response.body);
      throw new Error('Should error out');
    }
  });

  it('Create mm relation with non ltar column', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const firstNameColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'FirstName'
    )!;
    const refId = 1;
    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${firstNameColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Column not found') {
      console.log(response.body);
      throw new Error('Wrong error message');
    }
  });

  it('Create list mm existing ref row id', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const refId = 1;

    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(400);
  });

  it('Create list mm', async () => {
    // todo: Foreign key has non nullable clause in sqlite sakila
    if (isSqlite(context)) return;

    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const refId = 2;

    const lisResponseBeforeUpdate = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(200);
    global.touchedSakilaDb = true;

    const lisResponseAfterUpdate = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      lisResponseAfterUpdate.body.pageInfo.totalRows !==
      lisResponseBeforeUpdate.body.pageInfo.totalRows + 1
    ) {
      throw new Error('Wrong list length');
    }
  });

  it('List hm with non ltar column', async () => {
    const rowId = 1;
    const firstNameColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'FirstName'
    )!;

    await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${firstNameColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(400);
  });

  it('List mm with non ltar column', async () => {
    const rowId = 1;
    const firstNameColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'FirstName'
    )!;

    await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/mm/${firstNameColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(400);
  });

  it('Delete mm existing ref row id', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const refId = 1;

    const lisResponseBeforeDelete = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(200);
    global.touchedSakilaDb = true;

    const lisResponseAfterDelete = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      lisResponseAfterDelete.body.pageInfo.totalRows !==
      lisResponseBeforeDelete.body.pageInfo.totalRows - 1
    ) {
      throw new Error('Item not deleted');
    }
  });

  it('Delete list hm with existing ref row id with non nullable clause', async () => {
    // todo: Foreign key has non nullable clause in sqlite sakila
    if (isSqlite(context) || isPg(context)) return;

    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const refId = 76;

    const response = await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/${refId}`
      )
      .set('xc-auth', context.token)
      .expect(400);

    // todo: only keep generic error message once updated in noco catchError middleware
    if (
      !response.body.message?.includes("The column 'customer_id' cannot be null") &&
      !response.body.message?.includes("Column 'customer_id' cannot be null") &&
      !response.body.message?.includes('Cannot add or update a child row') &&
      !response.body.msg?.includes("Column 'customer_id' cannot be null") &&
      !response.body.msg?.includes('Cannot add or update a child row')
    ) {
      console.log(
        'Delete list hm with existing ref row id with non nullable clause',
        response.body
      );
      throw new Error('Wrong error message');
    }
  });

  it('Delete list hm with existing ref row id', async () => {
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

    const row = await createChildRow(context, {
      project,
      table,
      childTable: relatedTable,
      column: ltarColumn,
      type: 'hm',
    });
    const childRow = row['Ltar'][0];

    const response = await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${project.id}/${table.id}/${row['Id']}/hm/${ltarColumn.id}/${childRow['Id']}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const updatedRow = await getRow(context, { project, table, id: row['Id'] });

    if (updatedRow['Ltar'].length !== 0) {
      throw new Error('Was not deleted');
    }

    if (response.body['msg'] !== 'success') {
      throw new Error('Response incorrect');
    }
  });

  it('Exclude list hm', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body.pageInfo.totalRows !== 16012) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }
  });

  it('Exclude list hm with limit and offset', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/${rowId}/hm/${rentalListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .query({
        limit: 40,
        offset: 60,
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 16012) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (response.body.list[0]['RentalId'] !== 61) {
      console.log(response.body.list);
      throw new Error('Wrong rows');
    }
  });

  it('Exclude list mm', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body.pageInfo.totalRows !== 981) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }
  });

  it('Exclude list mm with offset', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${actorTable.id}/${rowId}/mm/${filmListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .query({
        limit: 40,
        offset: 60,
      })
      .expect(200);

    if (response.body.pageInfo.totalRows !== 981) {
      console.log(response.body.pageInfo);
      throw new Error('Wrong number of rows');
    }

    if (response.body.list[0]['FilmId'] !== 64) {
      console.log(response.body.list);
      throw new Error('Wrong rows');
    }
  });

  it('Exclude list bt', async () => {
    const rowId = 1;
    const addressTable = await getTable({
      project: sakilaProject,
      name: 'address',
    });
    const cityColumn = (await addressTable.getColumns()).find(
      (column) => column.title === 'City'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${addressTable.id}/${rowId}/bt/${cityColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body.pageInfo.totalRows).equal(599);
    expect(response.body.list[0]['City']).equal('A Corua (La Corua)');
  });

  it('Exclude list bt with offset', async () => {
    const rowId = 1;
    const addressTable = await getTable({
      project: sakilaProject,
      name: 'address',
    });
    const cityColumn = (await addressTable.getColumns()).find(
      (column) => column.title === 'City'
    )!;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${addressTable.id}/${rowId}/bt/${cityColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .query({
        limit: 40,
        offset: 60,
      })
      .expect(200);

    expect(response.body.pageInfo.totalRows).equal(599);
    expect(response.body.list[0]['City']).equal('Baybay');
  });

  it('Create nested hm relation with invalid table id', async () => {
    const rowId = 1;
    const rentalListColumn = (await customerTable.getColumns()).find(
      (column) => column.title === 'Rental List'
    )!;
    const refId = 1;
    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/hm/${rentalListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Table not found') {
      console.log(response.body['msg']);
      throw new Error('Wrong error message');
    }
  });

  it('Create nested mm relation with invalid table id', async () => {
    const rowId = 1;
    const actorTable = await getTable({
      project: sakilaProject,
      name: 'actor',
    });
    const filmListColumn = (await actorTable.getColumns()).find(
      (column) => column.title === 'Film List'
    )!;
    const response = await request(context.app)
      .post(
        `/api/v1/db/data/noco/${sakilaProject.id}/invalid-table-id/${rowId}/mm/${filmListColumn.id}/exclude`
      )
      .set('xc-auth', context.token)
      .expect(404);

    if (response.body['msg'] !== 'Table not found') {
      console.log(response.body['msg']);
      throw new Error('Wrong error message');
    }
  });

  it('Get grouped data list', async function () {
    const filmTable = await getTable({ project: sakilaProject, name: 'film' });

    const filmColumns = await filmTable.getColumns();

    const ratingColumn = filmColumns.find((c) => c.column_name === 'rating');

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/Film/group/${ratingColumn.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body).to.be.an('array');
    // PG, R, NC-17, G, PG-17, null (uncategorized)
    expect(response.body).to.be.have.length(6);
    expect(response.body[0]).to.have.property('key');
    expect(response.body[0]).to.have.property('value');
    expect(response.body[0])
      .to.have.property('value')
      .and.to.be.an('object')
      .and.to.have.property('list')
      .and.to.be.an('array');
    expect(response.body[0]).to.have.property('key').and.to.be.a('string');
    expect(response.body[0].value)
      .to.have.property('pageInfo')
      .and.to.be.an('object')
      .and.to.have.property('totalRows')
      .and.to.be.a('number');
  });
}

export default function () {
  describe('TableRow', tableTest);
}
