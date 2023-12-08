import 'mocha';
// @ts-ignore
import request from 'supertest';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import { createTable, getTable } from '../../factory/table';
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
import type { ColumnType } from 'nocodb-sdk';
import type View from '../../../../src/models/View';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';

// Test case list

const isColumnsCorrectInResponse = (row, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const customerColumnsListStr = columns
    .map((c) => c.title)
    .sort()
    .join(',');
  return responseColumnsListStr === customerColumnsListStr;
};

let context;
// bases
let base: Base;
let sakilaProject: Base;
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

const testGetViewRowList = async (view: View) => {
  const response = await request(context.app)
    .get(
      `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
    )
    .set('xc-auth', context.token)
    .expect(200);

  const pageInfo = response.body.pageInfo;
  if (pageInfo.totalRows !== 599 || response.body.list[0]['CustomerId'] !== 1) {
    throw new Error('View row list is not correct');
  }
};

const testGetViewRowListKanban = async (view: View) => {
  const ratingColumn = filmColumns.find((c) => c.column_name === 'rating');

  const response = await request(context.app)
    .get(
      `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
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

function viewRowStaticTests() {
  before(async function () {
    console.time('#### viewRowTests');
    context = await init();
    sakilaProject = await createSakilaProject(context);
    base = await createProject(context);
    customerTable = await getTable({
      base: sakilaProject,
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
      base: sakilaProject,
      name: 'film',
    });
    filmColumns = await filmTable.getColumns();
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });
    console.timeEnd('#### viewRowTests');
  });

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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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
        })),
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
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
        .join(','),
    ).to.equal('FilmId,Title');
  };
  it('Get grouped view data list with required columns kanban', async () => {
    await testGetGroupedViewDataListWithRequiredColumns(filmKanbanView);
  });

  const testDescSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
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
      response.body.find((e) => e.key === 'PG').value.list[0].Title,
    ).to.equal('WORST BANGER');
  };
  it('Get desc sorted table data list with required columns kanban', async function () {
    await testDescSortedGroupedViewDataList(filmKanbanView);
  });

  const testAscSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
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
      response.body.find((e) => e.key === 'PG').value.list[0].Title,
    ).to.equal('ACADEMY DINOSAUR');
  };
  it('Get asc sorted table data list with required columns kanban', async function () {
    await testAscSortedGroupedViewDataList(filmKanbanView);
  });
}

function viewRowTests() {
  beforeEach(async function () {
    console.time('#### viewRowTests');
    context = await init();
    sakilaProject = await createSakilaProject(context);
    base = await createProject(context);
    customerTable = await getTable({
      base: sakilaProject,
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
      base: sakilaProject,
      name: 'film',
    });
    filmColumns = await filmTable.getColumns();
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });
    console.timeEnd('#### viewRowTests');
  });

  const testGetViewDataListWithRequiredColumnsAndFilter = async (
    viewType: ViewTypes,
  ) => {
    const rentalTable = await getTable({
      base: sakilaProject,
      name: 'rental',
    });
    const view = await createView(context, {
      title: 'View',
      table: rentalTable,
      type: viewType,
    });

    const lookupColumn = await createLookupColumn(context, {
      base: sakilaProject,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });

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
      ],
    };

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`,
      )
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      });

    expect(response.body.pageInfo.totalRows).equal(9558);

    const ascResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`,
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
    viewType: ViewTypes,
  ) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: 'rental',
      relatedTableColumnTitle: 'RentalDate',
    });

    const activeColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Active',
    );

    const nestedFields = {
      Rentals: { fields: ['RentalDate', 'ReturnDate'] },
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
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

    if (parseInt(ascResponse.body.list[0][rollupColumn.title]) !== 12) {
      throw new Error('Wrong filter');
    }

    expect(+ascResponse.body.list[0]['Rentals']).to.equal(12);
  };

  it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table view grid', async () => {
    await testGetNestedSortedFilteredTableDataListWithLookupColumn(
      ViewTypes.GRID,
    );
  });

  // todo: gallery view doesnt seem to support rollup
  // it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table view gallery', async () => {
  //   await testGetNestedSortedFilteredTableDataListWithLookupColumn(ViewTypes.GALLERY);
  // })

  const testCreateRowView = async (viewType: ViewTypes) => {
    const table = await createTable(context, base);
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    const response = await request(context.app)
      .post(`/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(200);

    const row = response.body;
    if (row['Title'] !== 'Test') throw new Error('Wrong record title');
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
    const table = await createTable(context, base);
    const nonRelatedView = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${nonRelatedView.id}`,
      )
      .set('xc-auth', context.token)
      .send({
        title: 'Test',
      })
      .expect(404);
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
    viewType: ViewTypes,
  ) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });
    const firstNameColumn = customerColumns.find(
      (col) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];

    let response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`,
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
    viewType: ViewTypes,
  ) => {
    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
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

    const activeColumn = (await customerTable.getColumns()).find(
      (c) => c.title === 'Active',
    );

    const nestedFields = {
      Rentals: { f: 'RentalDate,ReturnDate' },
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/find-one`,
      )
      .set('xc-auth', context.token)
      .query({
        nested: nestedFields,
        filterArrJson: JSON.stringify([nestedFilter]),
        sort: `${rollupColumn.title}`,
      })
      .expect(200);

    if (parseInt(ascResponse.body[rollupColumn.title]) !== 12) {
      console.log('response.body', ascResponse.body);
      throw new Error('Wrong filter');
    }

    const nestedRentalResponse = Object.keys(ascResponse.body['Rentals']);
    if (
      nestedRentalResponse.includes('RentalId') &&
      nestedRentalResponse.includes('RentalDate') &&
      nestedRentalResponse.length === 2
    ) {
      throw new Error('Wrong nested fields');
    }
  };

  // todo: gallery view doesnt seem to support rollup
  // it('Find one sorted filtered view with nested fields data list with a rollup column in customer table GALLERY', async function () {
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
      (col) => col.title === 'FirstName',
    );

    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/groupby`,
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
        column_name: firstNameColumn.column_name,
      })
      .expect(200);

    if (
      response.body.list[4]['FirstName'] !== 'WILLIE' ||
      parseInt(response.body.list[4]['count']) !== 2
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
      (col) => col.title === 'FirstName',
    );

    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/groupby`,
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
        column_name: firstNameColumn.title,
        offset: 4,
      })
      .expect(200);

    if (
      response.body.list[0]['FirstName'] !== 'WILLIE' ||
      parseInt(response.body.list[0]['count']) !== 2
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/count`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (parseInt(response.body.count) !== 599) {
      throw new Error('Wrong count');
    }
  };
  it('Count view data list with required columns', async function () {
    await testCount(ViewTypes.GRID);
    await testCount(ViewTypes.FORM);
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    const row = listResponse.body.list[0];

    const readResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/${row['CustomerId']}`,
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
  it('Read view row', async function () {
    await testReadViewRow(ViewTypes.GALLERY);
    await testReadViewRow(ViewTypes.FORM);
    await testReadViewRow(ViewTypes.GRID);
  });

  const testUpdateViewRow = async (viewType: ViewTypes) => {
    const table = await createTable(context, base);
    const row = await createRow(context, { base, table });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    const updateResponse = await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}/${row['Id']}`,
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
    viewType: ViewTypes,
  ) => {
    const table = await createTable(context, base);
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

    const row = await createRow(context, { base, table });

    await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}/${row['Id']}`,
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
    viewType: ViewTypes,
  ) => {
    const table = await createTable(context, base);
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
    const row = await createRow(context, { base, table });

    const response = await request(context.app)
      .patch(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}/${row['Id']}`,
      )
      .set('xc-auth', context.token)
      .send({
        [emailColumn.column_name]: 'valid@example.com',
      })
      .expect(200);

    const updatedRow = await getRow(context, {
      base,
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
    const table = await createTable(context, base);
    const row = await createRow(context, { base, table });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
    });

    await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}/${row['Id']}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, { base, table, id: row['Id'] });
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

  const testDeleteViewRowWithForeignKeyConstraint = async (
    viewType: ViewTypes,
  ) => {
    const table = await createTable(context, base);
    const relatedTable = await createTable(context, base, {
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

    const row = await createRow(context, { base, table });

    await createChildRow(context, {
      base,
      table,
      childTable: relatedTable,
      column: ltarColumn,
      type: 'hm',
      rowId: row['Id'],
    });

    await request(context.app)
      .delete(
        `/api/v1/db/data/noco/${base.id}/${table.id}/views/${view.id}/${row['Id']}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    const deleteRow = await getRow(context, { base, table, id: row['Id'] });
    if (deleteRow !== undefined) {
      throw new Error('Record should have been deleted!');
    }
  };
  it('Delete view row with ltar foreign key constraint GALLERY', async function () {
    await testDeleteViewRowWithForeignKeyConstraint(ViewTypes.GALLERY);
  });
  it('Delete view row with ltar foreign key constraint GRID', async function () {
    await testDeleteViewRowWithForeignKeyConstraint(ViewTypes.GRID);
  });
  it('Delete view row with ltar foreign key constraint FORM', async function () {
    await testDeleteViewRowWithForeignKeyConstraint(ViewTypes.FORM);
  });

  const testViewRowExists = async (viewType: ViewTypes) => {
    const row = await getOneRow(context, {
      base: sakilaProject,
      table: customerTable,
    });
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: viewType,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/${row['CustomerId']}/exist`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (!response.body) {
      throw new Error('Should exist');
    }
  };
  it(`Exist view row : should return true when row exists in view`, async function () {
    await testViewRowExists(ViewTypes.GALLERY);
    await testViewRowExists(ViewTypes.GRID);
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}/views/${view.id}/999999/exist`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body) {
      throw new Error('Should not exist');
    }
  };
  it(`Exist view row : should return false when row doesn't exist in view`, async function () {
    await testViewRowNotExists(ViewTypes.GALLERY);
    await testViewRowNotExists(ViewTypes.GRID);
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/views/${view.id}/export/csv`,
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
        `/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.title}/views/${view.id}/export/excel`,
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
  describe('ViewRow', viewRowStaticTests);
}
