import 'mocha';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/project';
import request from 'supertest';
import Project from '../../../../src/lib/models/Project';
import Model from '../../../../src/lib/models/Model';
import { createTable, getTable } from '../../factory/table';
import View from '../../../../src/lib/models/View';
import { ColumnType, UITypes, ViewTypes } from 'nocodb-sdk';
import { createView } from '../../factory/view';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
  updateViewColumn,
} from '../../factory/column';
import {
  createChildRow,
  createRow,
  getOneRow,
  getRow,
} from '../../factory/row';
import { expect } from 'chai';

// Test case list
// 1. Get view row list g
// 2. Get view row list
// 3. Get view row lis
// 4. Get view row lis
// 5. Get view data list with required columns g
// 6. Get view data list with required column
// 7. Get view data list with required column
// 8. Get grouped view data list with required columns
// 9. Get desc sorted table data list with required columns gallery
// 10. Get desc sorted table data list with required columns form
// 11. Get desc sorted table data list with required columns grid
// 12. Get desc sorted table data list with required columns kanban
// 13. Get asc sorted view data list with required columns gallery
// 14. Get asc sorted view data list with required columns form
// 15. Get asc sorted view data list with required columns grid
// 16. Get asc sorted table data list with required columns kanban
// 17. Get nested sorted filtered table data list with a lookup column gallery
// 18. Get nested sorted filtered table data list with a lookup column grid
// 19. Get nested sorted filtered table with nested fields data list with a rollup column in customer table vie
// 20. Create table row grid
// 21. Create table row gallery
// 22. Create table row form
// 23. Create table row kanban
// 24. Create table row grid wrong grid id
// 25. Create table row wrong gallery id
// 26. Create table row wrong form id
// 27. Create table row wrong kanban id
// 28. Find one sorted data list with required columns gallery
// 29. Find one sorted data list with required columns form
// 30. Find one sorted data list with required columns grid
// 31. Find one view sorted filtered view with nested fields data list with a rollup column in customer table GRID
// 32. Groupby desc sorted and with rollup view data  list with required columns GRID
// 33. Groupby desc sorted and with rollup view data  list with required columns FORM
// 34. Groupby desc sorted and with rollup view data  list with required columns GALLERY
// 35. Groupby desc sorted and with rollup view data  list with required columns GALLERY
// 36. Groupby desc sorted and with rollup view data  list with required columns FORM
// 37. Groupby desc sorted and with rollup view data  list with required columns GRID
// 38. Count view data  list with required columns GRID
// 39. Count view data  list with required columns FORM
// 40. Count view data  list with required columns GALLERY
// 41. Read view row GALLERY
// 42. Read view row FORM
// 43. Read view row GRID
// 44. Update view row GALLERY
// 45. Update view row GRID
// 46. Update view row FORM
// 47. Update view row with validation and invalid data GALLERY
// 48. Update view row with validation and invalid data GRID
// 49. Update view row with validation and invalid data FORM
// 50. Update view row with validation and valid data GALLERY
// 51. Update view row with validation and valid data GRID
// 52. Update view row with validation and valid data FORM
// 53. Delete view row GALLERY
// 54. Delete view row GRID
// 55. Delete view row FORM
// 56. Delete view row with ltar foreign key constraint GALLERY
// 57. Delete view row with ltar foreign key constraint GRID
// 58. Delete view row with ltar foreign key constraint FORM
// 59. Exist should be true view row when it exists GALLERY
// 60. Exist should be true view row when it exists GRID
// 61. Exist should be true view row when it exists FORM
// 62. Exist should be false view row when it does not exist GALLERY
// 63. Exist should be false view row when it does not exist GRID
// 64. Exist should be false view row when it does not exist FORM
// 65. Export csv GRID
// 66. Export excel GRID

const isColumnsCorrectInResponse = (row, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const customerColumnsListStr = columns
    .map((c) => c.title)
    .sort()
    .join(',');
  return responseColumnsListStr === customerColumnsListStr;
};

function viewRowTests() {
  let context;
  // projects
  let project: Project;
  let sakilaProject: Project;
  // models
  let customerTable: Model;
  let filmTable: Model;
  // columns
  let customerColumns;
  let filmColumns;
  // views
  let customerGridView: View;
  let customerGalleryView: View;
  let customerFormView: View;
  // use film table because it has single select field
  let filmKanbanView: View;

  beforeEach(async function () {
    context = await init();
    sakilaProject = await createSakilaProject(context);
    project = await createProject(context);
    customerTable = await getTable({
      project: sakilaProject,
      name: 'customer',
    });
    customerColumns = await customerTable.getColumns();
    customerGridView = await createView(context, {
      title: 'Customer Gallery',
      table: customerTable,
      type: ViewTypes.GRID,
    });
    customerGalleryView = await createView(context, {
      title: 'Customer Gallery',
      table: customerTable,
      type: ViewTypes.GALLERY,
    });
    customerFormView = await createView(context, {
      title: 'Customer Form',
      table: customerTable,
      type: ViewTypes.FORM,
    });

    filmTable = await getTable({
      project: sakilaProject,
      name: 'film',
    });
    filmColumns = await filmTable.getColumns();
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });
  });

  const testGetViewRowList = async (view: View) => {
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body.pageInfo;
    if (
      pageInfo.totalRows !== 599 ||
      response.body.list[0]['CustomerId'] !== 1
    ) {
      throw new Error('View row list is not correct');
    }
  };

  const testGetViewRowListKanban = async (view: View) => {
    const ratingColumn = filmColumns.find((c) => c.column_name === 'rating');

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`
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
  };

  it('Get view row list gallery', async () => {
    await testGetViewRowList(customerGalleryView);
  });

  it('Get view row list kanban', async () => {
    await testGetViewRowListKanban(filmKanbanView);
  });

  it('Get view row list form', async () => {
    await testGetViewRowList(customerFormView);
  });

  it('Get view row list grid', async () => {
    await testGetViewRowList(customerGridView);
  });

  const testGetViewDataListWithRequiredColumns = async (view: View) => {
    const requiredColumns = customerColumns
      .filter((_, index) => index < 3)
      .filter((c: ColumnType) => c.uidt !== UITypes.ForeignKey);

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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
      console.log(
        response.body.list[0],
        requiredColumns.map((c: ColumnType) => ({
          title: c.title,
          uidt: c.uidt,
        }))
      );
      throw new Error('Wrong columns');
    }
  };

  it('Get view data list with required columns gallery', async () => {
    await testGetViewDataListWithRequiredColumns(customerGalleryView);
  });

  it('Get view data list with required columns form', async () => {
    await testGetViewDataListWithRequiredColumns(customerFormView);
  });

  it('Get view data list with required columns grid', async () => {
    await testGetViewDataListWithRequiredColumns(customerGridView);
  });

  const testGetGroupedViewDataListWithRequiredColumns = async (view: View) => {
    const requiredColumns = filmColumns
      .filter((_, index) => index < 3)
      .filter((c: ColumnType) => c.uidt !== UITypes.ForeignKey);

    const ratingColumn = filmColumns.find((c) => c.column_name === 'rating');

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`
      )
      .set('xc-auth', context.token)
      .query({
        fields: requiredColumns.map((c) => c.title),
      })
      .expect(200);

    expect(response.body).to.be.an('array');

    // PG, R, NC-17, G, PG-17, null (uncategorized)
    expect(response.body).to.be.have.length(6);

    expect(
      Object.keys(response.body.find((e) => e.key === 'NC-17').value.list[0])
        .sort()
        .join(',')
    ).to.equal('FilmId,Title');
  };

  it('Get grouped view data list with required columns kanban', async () => {
    await testGetGroupedViewDataListWithRequiredColumns(filmKanbanView);
  });

  const testDescSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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
  };

  it('Get desc sorted table data list with required columns gallery', async function () {
    await testDescSortedViewDataList(customerGalleryView);
  });

  it('Get desc sorted table data list with required columns form', async function () {
    await testDescSortedViewDataList(customerFormView);
  });

  it('Get desc sorted table data list with required columns grid', async function () {
    await testDescSortedViewDataList(customerGridView);
  });

  const testDescSortedGroupedViewDataList = async (view: View) => {
    const ratingColumn = filmColumns.find((c) => c.title === 'Rating');

    const titleColumn = filmColumns.find((col) => col.title === 'Title');

    const visibleColumns = [titleColumn];

    const sortInfo = [{ fk_column_id: titleColumn.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);

    expect(response.body).to.be.an('array');

    // PG, R, NC-17, G, PG-17, null (uncategorized)
    expect(response.body).to.be.have.length(6);

    expect(
      response.body.find((e) => e.key === 'PG').value.list[0].Title
    ).to.equal('WORST BANGER');
  };

  it('Get desc sorted table data list with required columns kanban', async function () {
    await testDescSortedGroupedViewDataList(filmKanbanView);
  });

  const testAscSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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
  };

  it('Get asc sorted view data list with required columns gallery', async function () {
    await testAscSortedViewDataList(customerGalleryView);
  });

  it('Get asc sorted view data list with required columns form', async function () {
    await testAscSortedViewDataList(customerFormView);
  });

  it('Get asc sorted view data list with required columns grid', async function () {
    await testAscSortedViewDataList(customerGridView);
  });

  const testAscSortedGroupedViewDataList = async (view: View) => {
    const ratingColumn = filmColumns.find((c) => c.title === 'Rating');

    const titleColumn = filmColumns.find((col) => col.title === 'Title');

    const visibleColumns = [titleColumn];

    const sortInfo = [{ fk_column_id: titleColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sortArrJson: JSON.stringify(sortInfo),
      })
      .expect(200);

    expect(response.body).to.be.an('array');

    // PG, R, NC-17, G, PG-17, null (uncategorized)
    expect(response.body).to.be.have.length(6);

    expect(
      response.body.find((e) => e.key === 'PG').value.list[0].Title
    ).to.equal('ACADEMY DINOSAUR');
  };

  it('Get asc sorted table data list with required columns kanban', async function () {
    await testAscSortedGroupedViewDataList(filmKanbanView);
  });

  const testGetViewDataListWithRequiredColumnsAndFilter = async (
    viewType: ViewTypes
  ) => {
    const rentalTable = await getTable({
      project: sakilaProject,
      name: 'rental',
    });
    const view = await createView(context, {
      title: 'View',
      table: rentalTable,
      type: viewType,
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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`
      )
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      });

    expect(response.body.pageInfo.totalRows).equal(9558);

    const ascResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`
      )
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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`
      )
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
  };

  it('Get nested sorted filtered table data list with a lookup column gallery', async function () {
    await testGetViewDataListWithRequiredColumnsAndFilter(ViewTypes.GALLERY);
  });

  it('Get nested sorted filtered table data list with a lookup column grid', async function () {
    await testGetViewDataListWithRequiredColumnsAndFilter(ViewTypes.GRID);
  });

  const testGetNestedSortedFilteredTableDataListWithLookupColumn = async (
    viewType: ViewTypes
  ) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

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
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
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

    expect(ascResponse.body.pageInfo.totalRows).equal(594);

    if (ascResponse.body.list[0][rollupColumn.title] !== 12) {
      throw new Error('Wrong filter');
    }

    const nestedRentalResponse = Object.keys(
      ascResponse.body.list[0]['Rental List'][0]
    );

    if (
      !(
        nestedRentalResponse.includes('ReturnDate') &&
        nestedRentalResponse.includes('RentalDate') &&
        nestedRentalResponse.length === 2
      )
    ) {
      throw new Error('Wrong nested fields');
    }
  };

  it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table view grid', async () => {
    await testGetNestedSortedFilteredTableDataListWithLookupColumn(
      ViewTypes.GRID
    );
  });

  // todo: gallery view doesnt seem to support rollup
  // it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table view gallery', async () => {
  //   await testGetNestedSortedFilteredTableDataListWithLookupColumn(ViewTypes.GALLERY);
  // })

  const testCreateRowView = async (viewType: ViewTypes) => {
    const table = await createTable(context, project);
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(200);

    const row = response.body;
    if (row['Title'] !== 'Test') throw new Error('Wrong row title');
  };

  it('Create table row grid', async function () {
    await testCreateRowView(ViewTypes.GRID);
  });

  it('Create table row gallery', async function () {
    await testCreateRowView(ViewTypes.GALLERY);
  });

  it('Create table row form', async function () {
    await testCreateRowView(ViewTypes.FORM);
  });

  it('Create table row kanban', async function () {
    await testCreateRowView(ViewTypes.KANBAN);
  });

  const testCreateRowViewWithWrongView = async (viewType: ViewTypes) => {
    const table = await createTable(context, project);
    const nonRelatedView = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${nonRelatedView.id}`
      )
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(400);
  };

  it('Create table row grid wrong grid id', async function () {
    await testCreateRowViewWithWrongView(ViewTypes.GRID);
  });

  it('Create table row wrong gallery id', async function () {
    await testCreateRowViewWithWrongView(ViewTypes.GALLERY);
  });

  it('Create table row wrong form id', async function () {
    await testCreateRowViewWithWrongView(ViewTypes.FORM);
  });

  it('Create table row wrong kanban id', async function () {
    await testCreateRowViewWithWrongView(ViewTypes.KANBAN);
  });

  // todo: Test that all the columns needed to be shown in the view are returned

  const testFindOneSortedDataWithRequiredColumns = async (
    viewType: ViewTypes
  ) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName'
    );
    const visibleColumns = [firstNameColumn];

    let response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`
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
  };

  it('Find one sorted data list with required columns gallery', async function () {
    await testFindOneSortedDataWithRequiredColumns(ViewTypes.GALLERY);
  });

  it('Find one sorted data list with required columns form', async function () {
    await testFindOneSortedDataWithRequiredColumns(ViewTypes.FORM);
  });

  it('Find one sorted data list with required columns grid', async function () {
    await testFindOneSortedDataWithRequiredColumns(ViewTypes.GRID);
  });

  const testFindOneSortedFilteredNestedFieldsDataWithRollup = async (
    viewType: ViewTypes
  ) => {
    const rollupColumn = await createRollupColumn(context, {
      project: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    await updateViewColumn(context, {
      column: rollupColumn,
      view: view,
      attr: { show: true },
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`
      )
      .set('xc-auth', context.token)
      .query({
        nested: nestedFields,
        filterArrJson: JSON.stringify([nestedFilter]),
        sort: `${rollupColumn.title}`,
      })
      .expect(200);

    if (ascResponse.body[rollupColumn.title] !== 12) {
      console.log('response.body', ascResponse.body);
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
  };

  // todo: gallery view doesnt seem to support rollup
  // it.only('Find one sorted filtered view with nested fields data list with a rollup column in customer table GALLERY', async function () {
  //   await testFindOneSortedFilteredNestedFieldsDataWithRollup(ViewTypes.GALLERY);
  // });

  // it('Find one sorted filtered view with nested fields data list with a rollup column in customer table FORM', async function () {
  //   await testFindOneSortedFilteredNestedFieldsDataWithRollup(ViewTypes.FORM);
  // });

  it('Find one view sorted filtered view with nested fields data list with a rollup column in customer table GRID', async function () {
    await testFindOneSortedFilteredNestedFieldsDataWithRollup(ViewTypes.GRID);
  });

  const testGroupDescSorted = async (viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/groupby`
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
  };

  it('Groupby desc sorted and with rollup view data  list with required columns GRID', async function () {
    await testGroupDescSorted(ViewTypes.GRID);
  });

  it('Groupby desc sorted and with rollup view data  list with required columns FORM', async function () {
    await testGroupDescSorted(ViewTypes.FORM);
  });

  it('Groupby desc sorted and with rollup view data  list with required columns GALLERY', async function () {
    await testGroupDescSorted(ViewTypes.GALLERY);
  });

  const testGroupWithOffset = async (viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/groupby`
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
  };

  it('Groupby desc sorted and with rollup view data  list with required columns GALLERY', async function () {
    await testGroupWithOffset(ViewTypes.GALLERY);
  });

  it('Groupby desc sorted and with rollup view data  list with required columns FORM', async function () {
    await testGroupWithOffset(ViewTypes.FORM);
  });

  it('Groupby desc sorted and with rollup view data  list with required columns GRID', async function () {
    await testGroupWithOffset(ViewTypes.GRID);
  });

  const testCount = async (viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/count`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body.count !== 599) {
      throw new Error('Wrong count');
    }
  };

  it('Count view data  list with required columns GRID', async function () {
    await testCount(ViewTypes.GRID);
  });

  it('Count view data  list with required columns FORM', async function () {
    await testCount(ViewTypes.FORM);
  });

  it('Count view data  list with required columns GALLERY', async function () {
    await testCount(ViewTypes.GALLERY);
  });

  const testReadViewRow = async (viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    const listResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const row = listResponse.body.list[0];

    const readResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/${row['CustomerId']}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      row['CustomerId'] !== readResponse.body['CustomerId'] ||
      row['FirstName'] !== readResponse.body['FirstName']
    ) {
      throw new Error('Wrong read');
    }
  };

  it('Read view row GALLERY', async function () {
    await testReadViewRow(ViewTypes.GALLERY);
  });

  it('Read view row FORM', async function () {
    await testReadViewRow(ViewTypes.FORM);
  });

  it('Read view row GRID', async function () {
    await testReadViewRow(ViewTypes.GRID);
  });

  const testUpdateViewRow = async (viewType: ViewTypes) => {
    const table = await createTable(context, project);
    const row = await createRow(context, { project, table });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    const updateResponse = await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}/${row['Id']}`
      )
      .set('xc-auth', context.token)
      .send({
        title: 'Updated',
      })
      .expect(200);

    if (updateResponse.body['Title'] !== 'Updated') {
      throw new Error('Wrong update');
    }
  };

  it('Update view row GALLERY', async function () {
    await testUpdateViewRow(ViewTypes.GALLERY);
  });

  it('Update view row GRID', async function () {
    await testUpdateViewRow(ViewTypes.GRID);
  });

  it('Update view row FORM', async function () {
    await testUpdateViewRow(ViewTypes.FORM);
  });

  const testUpdateViewRowWithValidationAndInvalidData = async (
    viewType: ViewTypes
  ) => {
    const table = await createTable(context, project);
    const emailColumn = await createColumn(context, table, {
      title: 'Email',
      column_name: 'email',
      uidt: UITypes.Email,
      meta: {
        validate: true,
      },
    });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    const row = await createRow(context, { project, table });

    await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}/${row['Id']}`
      )
      .set('xc-auth', context.token)
      .send({
        [emailColumn.column_name]: 'invalidemail',
      })
      .expect(400);
  };

  it('Update view row with validation and invalid data GALLERY', async function () {
    await testUpdateViewRowWithValidationAndInvalidData(ViewTypes.GALLERY);
  });

  it('Update view row with validation and invalid data GRID', async function () {
    await testUpdateViewRowWithValidationAndInvalidData(ViewTypes.GRID);
  });

  it('Update view row with validation and invalid data FORM', async function () {
    await testUpdateViewRowWithValidationAndInvalidData(ViewTypes.FORM);
  });

  // todo: Test webhooks of before and after update
  // todo: Test with form view

  const testUpdateViewRowWithValidationAndValidData = async (
    viewType: ViewTypes
  ) => {
    const table = await createTable(context, project);
    const emailColumn = await createColumn(context, table, {
      title: 'Email',
      column_name: 'email',
      uidt: UITypes.Email,
      meta: {
        validate: true,
      },
    });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });
    const row = await createRow(context, { project, table });

    const response = await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}/${row['Id']}`
      )
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
  };

  it('Update view row with validation and valid data GALLERY', async function () {
    await testUpdateViewRowWithValidationAndValidData(ViewTypes.GALLERY);
  });

  it('Update view row with validation and valid data GRID', async function () {
    await testUpdateViewRowWithValidationAndValidData(ViewTypes.GRID);
  });

  it('Update view row with validation and valid data FORM', async function () {
    await testUpdateViewRowWithValidationAndValidData(ViewTypes.FORM);
  });

  const testDeleteViewRow = async (viewType: ViewTypes) => {
    const table = await createTable(context, project);
    const row = await createRow(context, { project, table });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}/${row['Id']}`
      )
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, { project, table, id: row['Id'] });
    if (deleteRow && Object.keys(deleteRow).length > 0) {
      console.log(deleteRow);
      throw new Error('Wrong delete');
    }
  };

  it('Delete view row GALLERY', async function () {
    await testDeleteViewRow(ViewTypes.GALLERY);
  });

  it('Delete view row GRID', async function () {
    await testDeleteViewRow(ViewTypes.GRID);
  });

  it('Delete view row FORM', async function () {
    await testDeleteViewRow(ViewTypes.FORM);
  });

  const testDeleteViewRowWithForiegnKeyConstraint = async (
    viewType: ViewTypes
  ) => {
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
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
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
      .delete(
        `/api/v1/db/data/noco/${project.id}/${table.id}/views/${view.id}/${row['Id']}`
      )
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
  };

  it('Delete view row with ltar foreign key constraint GALLERY', async function () {
    await testDeleteViewRowWithForiegnKeyConstraint(ViewTypes.GALLERY);
  });

  it('Delete view row with ltar foreign key constraint GRID', async function () {
    await testDeleteViewRowWithForiegnKeyConstraint(ViewTypes.GRID);
  });

  it('Delete view row with ltar foreign key constraint FORM', async function () {
    await testDeleteViewRowWithForiegnKeyConstraint(ViewTypes.FORM);
  });

  const testViewRowExists = async (viewType: ViewTypes) => {
    const row = await getOneRow(context, {
      project: sakilaProject,
      table: customerTable,
    });
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/${row['CustomerId']}/exist`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (!response.body) {
      throw new Error('Should exist');
    }
  };

  it('Exist should be true view row when it exists GALLERY', async function () {
    await testViewRowExists(ViewTypes.GALLERY);
  });

  it('Exist should be true view row when it exists GRID', async function () {
    await testViewRowExists(ViewTypes.GRID);
  });

  it('Exist should be true view row when it exists FORM', async function () {
    await testViewRowExists(ViewTypes.FORM);
  });

  const testViewRowNotExists = async (viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/invalid-id/exist`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body) {
      throw new Error('Should not exist');
    }
  };

  it('Exist should be false view row when it does not exist GALLERY', async function () {
    await testViewRowNotExists(ViewTypes.GALLERY);
  });

  it('Exist should be false view row when it does not exist GRID', async function () {
    await testViewRowNotExists(ViewTypes.GRID);
  });

  it('Exist should be false view row when it does not exist FORM', async function () {
    await testViewRowNotExists(ViewTypes.FORM);
  });

  it('Export csv GRID', async function () {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: ViewTypes.GRID,
    });
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/views/${view.id}/export/csv`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      !response['header']['content-disposition'].includes('View-export.csv')
    ) {
      console.log(response['header']['content-disposition']);
      throw new Error('Wrong file name');
    }
    if (!response.text) {
      throw new Error('Wrong export');
    }
  });

  it('Export excel GRID', async function () {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: ViewTypes.GRID,
    });
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/views/${view.id}/export/excel`
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      !response['header']['content-disposition'].includes('View-export.xlsx')
    ) {
      console.log(response['header']['content-disposition']);
      throw new Error('Wrong file name');
    }
    if (!response.text) {
      throw new Error('Wrong export');
    }
  });
}

export default function () {
  describe('ViewRow', viewRowTests);
}
