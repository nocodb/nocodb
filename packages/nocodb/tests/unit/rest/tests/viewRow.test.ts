import 'mocha';
// @ts-ignore
import assert from 'assert';
import request from 'supertest';
import { APIContext, UITypes, ViewTypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import { createTable, getAllTables, getTable } from '../../factory/table';
import { createView, getView } from '../../factory/view';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
  defaultColumns,
  updateViewColumn,
} from '../../factory/column';
import {
  createChildRow,
  createRow,
  getOneRow,
  getRow,
  listRow,
} from '../../factory/row';
import Model from '../../../../src/models/Model';
import { getViewColumns, updateViewColumns } from '../../factory/viewColumns';
import type { ColumnType } from 'nocodb-sdk';
import type View from '../../../../src/models/View';
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
let sakilaCtx: {
  workspace_id: string;
  base_id: string;
};
let ctx: {
  workspace_id: string;
  base_id: string;
};
// bases
let base: Base;
let sakilaProject: Base;
// models
let customerTable: Model;
let filmTable: Model;
let rentalTable: Model;

// columns
let customerColumns;
let filmColumns;
let rentalColumns;
// views
let customerGridView: View;
let customerGalleryView: View;
let customerFormView: View;
// use film table because it has single select field
let filmKanbanView: View;

// Use rental table because it has a date field
let rentalCalendarView: View;

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

const testGetViewListCalendar = async (view: View) => {
  const response = await request(context.app)
    .get(
      `/api/v1/db/data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}`,
    )
    .set('xc-auth', context.token)
    .expect(200);

  const pageInfo = response.body.pageInfo;

  if (pageInfo.totalRows !== 16044 && response.body.list.length !== 16044) {
    throw new Error('Calendar View row list is not correct');
  }
};

function viewRowStaticTests() {
  before(async function () {
    console.time('#### viewRowTests');
    context = await init();
    sakilaProject = await createSakilaProject(context);
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    sakilaCtx = {
      workspace_id: sakilaProject.fk_workspace_id,
      base_id: sakilaProject.id,
    };
    customerTable = await getTable({
      base: sakilaProject,
      name: 'customer',
    });
    customerColumns = await customerTable.getColumns(sakilaCtx);
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
    filmColumns = await filmTable.getColumns(sakilaCtx);
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });

    rentalTable = await getTable({
      base: sakilaProject,
      name: 'rental',
    });

    rentalColumns = await rentalTable.getColumns(sakilaCtx);

    rentalCalendarView = await createView(context, {
      title: 'Rental Calendar',
      table: rentalTable,
      type: ViewTypes.CALENDAR,
      range: {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      },
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

  it('Get view row list Calendar', async () => {
    await testGetViewListCalendar(rentalCalendarView);
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
    ).to.equal('Description,FilmId,Title');
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
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    sakilaCtx = {
      workspace_id: sakilaProject.fk_workspace_id,
      base_id: sakilaProject.id,
    };
    customerTable = await getTable({
      base: sakilaProject,
      name: 'customer',
    });
    customerColumns = await customerTable.getColumns(sakilaCtx);
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
    filmColumns = await filmTable.getColumns(sakilaCtx);
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });

    rentalTable = await getTable({
      base: sakilaProject,
      name: 'rental',
    });

    rentalColumns = await rentalTable.getColumns(sakilaCtx);

    rentalCalendarView = await createView(context, {
      title: 'Rental Calendar',
      table: rentalTable,
      type: ViewTypes.CALENDAR,
      range: {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      },
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

  it('Get nested sorted filtered table data list with a lookup column Calendar', async function () {
    await testGetViewDataListWithRequiredColumnsAndFilter(ViewTypes.CALENDAR);
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

    const activeColumn = (await customerTable.getColumns(sakilaCtx)).find(
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

  it('Create table row Calendar', async function () {
    await testCreateRowView(ViewTypes.CALENDAR);
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

  it('Create table row wrong calendar id', async function () {
    await testCreateRowViewWithWrongView(ViewTypes.CALENDAR);
  });

  // todo: Test that all the columns needed to be shown in the view are returned

  const testFindOneSortedDataWithRequiredColumns = async (
    viewType: ViewTypes,
  ) => {
    const table = viewType === ViewTypes.CALENDAR ? rentalTable : customerTable;
    const view = await createView(context, {
      title: 'View',
      table: table,
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

    const activeColumn = (await customerTable.getColumns(sakilaCtx)).find(
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
  it('Groupby desc sorted and with rollup view data  list with required columns CALENDAR', async function () {
    await testGroupDescSorted(ViewTypes.CALENDAR);
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
  it('Groupby desc sorted and with rollup view data  list with required columns CALENDAR', async function () {
    await testGroupWithOffset(ViewTypes.CALENDAR);
  });

  const testCount = async (viewType: ViewTypes) => {
    let calendar_range = {};
    let table;

    if (viewType === ViewTypes.CALENDAR) {
      table = rentalTable;
      calendar_range = {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      };
    } else {
      table = customerTable;
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${table.id}/views/${view.id}/count`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (viewType === ViewTypes.CALENDAR) {
      if (parseInt(response.body.count) !== 16044) {
        throw new Error('Wrong count');
      }
    } else {
      if (parseInt(response.body.count) !== 599) {
        throw new Error('Wrong count');
      }
    }
  };
  it('Count view data list with required columns', async function () {
    await testCount(ViewTypes.GRID);
    await testCount(ViewTypes.FORM);
    await testCount(ViewTypes.GALLERY);
    await testCount(ViewTypes.CALENDAR);
  });

  const testReadViewRow = async (viewType: ViewTypes) => {
    let table;
    let calendar_range = {};

    let Id = 'CustomerId';
    if (viewType === ViewTypes.CALENDAR) {
      table = rentalTable;
      calendar_range = {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      };
      Id = 'RentalId';
    } else {
      table = customerTable;
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
    });

    const listResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${table.id}/views/${view.id}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    const row = listResponse.body.list[0];

    const readResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${table.id}/views/${view.id}/${row[Id]}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    if (
      row[Id] !== readResponse.body[Id] ||
      row['FirstName'] !== readResponse.body['FirstName']
    ) {
      throw new Error('Wrong read');
    }
  };
  it('Read view row', async function () {
    await testReadViewRow(ViewTypes.GALLERY);
    await testReadViewRow(ViewTypes.FORM);
    await testReadViewRow(ViewTypes.GRID);
    await testReadViewRow(ViewTypes.CALENDAR);
  });

  const testUpdateViewRow = async (viewType: ViewTypes) => {
    const table = await createTable(context, base);
    const row = await createRow(context, { base, table });

    let calendar_range = {};

    if (viewType === ViewTypes.CALENDAR) {
      const column = await createColumn(context, table, {
        title: 'RentalDate',
        column_name: 'rental_date',
        uidt: UITypes.Date,
      });
      calendar_range = {
        fk_from_column_id: column.id,
      };
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
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
  it('Update view row CALENDAR', async function () {
    await testUpdateViewRow(ViewTypes.CALENDAR);
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

    let calendar_range = {};

    if (viewType === ViewTypes.CALENDAR) {
      const column = await createColumn(context, table, {
        title: 'RentalDate',
        column_name: 'rental_date',
        uidt: UITypes.Date,
      });
      calendar_range = {
        fk_from_column_id: column.id,
      };
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
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
  it('Update view row with validation and invalid data CALENDAR', async function () {
    await testUpdateViewRowWithValidationAndInvalidData(ViewTypes.CALENDAR);
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

    let calendar_range = {};

    if (viewType === ViewTypes.CALENDAR) {
      const column = await createColumn(context, table, {
        title: 'RentalDate',
        column_name: 'rental_date',
        uidt: UITypes.Date,
      });
      calendar_range = {
        fk_from_column_id: column.id,
      };
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
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
  it('Update view row with validation and valid data CALENDAR', async function () {
    await testUpdateViewRowWithValidationAndValidData(ViewTypes.CALENDAR);
  });

  const testDeleteViewRow = async (viewType: ViewTypes) => {
    const table = await createTable(context, base);

    let calendar_range = {};
    if (viewType === ViewTypes.CALENDAR) {
      const range = await createColumn(context, table, {
        title: 'RentalDate',
        column_name: 'rental_date',
        uidt: UITypes.Date,
      });
      calendar_range = {
        fk_from_column_id: range.id,
      };
    }

    const row = await createRow(context, { base, table });
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
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
  it('Delete view row CALENDAR', async function () {
    await testDeleteViewRow(ViewTypes.CALENDAR);
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
  it('Delete view row with ltar foreign key constraint Calendar', async function () {
    await testDeleteViewRowWithForeignKeyConstraint(ViewTypes.CALENDAR);
  });

  const testViewRowExists = async (viewType: ViewTypes) => {
    let table;
    let calendar_range = {};
    let colTitle;

    if (viewType === ViewTypes.CALENDAR) {
      colTitle = 'RentalId';
      table = rentalTable;
      calendar_range = {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalId').id,
      };
    } else {
      table = customerTable;
      colTitle = 'CustomerId';
    }
    const row = await getOneRow(context, {
      base: sakilaProject,
      table: table,
    });

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${table.id}/views/${view.id}/${row[colTitle]}/exist`,
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
    await testViewRowExists(ViewTypes.CALENDAR);
  });

  const testViewRowNotExists = async (viewType: ViewTypes) => {
    let calendar_range = {};
    if (viewType === ViewTypes.CALENDAR) {
      calendar_range = {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      };
    }
    let table;

    if (viewType === ViewTypes.CALENDAR) {
      table = rentalTable;
    } else {
      table = customerTable;
    }

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: viewType,
      range: calendar_range,
    });
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${sakilaProject.id}/${table.id}/views/${view.id}/999999/exist`,
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
    await testViewRowNotExists(ViewTypes.CALENDAR);
  });

  const testCalendarDataApi = async () => {
    const table = rentalTable;
    const calendar_range = {
      fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate').id,
    };

    const view = await createView(context, {
      title: 'View',
      table: table,
      type: ViewTypes.CALENDAR,
      range: calendar_range,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/calendar-data/noco/${sakilaProject.id}/${table.id}/views/${view.id}`,
      )
      .query({
        from_date: '2005-05-25',
        to_date: '2005-05-26',
      })
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body.list.length !== 137) {
      throw new Error('Wrong calendar data');
    }
  };

  it('Calendar data', async function () {
    await testCalendarDataApi();
  });

  const testCountDatesByRange = async (viewType: ViewTypes) => {
    let calendar_range = {};
    let expectStatus = 400;

    if (viewType === ViewTypes.CALENDAR) {
      calendar_range = {
        fk_from_column_id: rentalColumns.find((c) => c.title === 'RentalDate')
          .id,
      };
      expectStatus = 200;
    }

    const view = await createView(context, {
      title: 'View',
      table: rentalTable,
      type: viewType,
      range: calendar_range,
    });

    const response = await request(context.app)
      .get(
        `/api/v1/db/calendar-data/noco/${sakilaProject.id}/${rentalTable.id}/views/${view.id}/countByDate/`,
      )
      .query({
        from_date: '2005-05-25',
        to_date: '2005-05-26',
      })
      .set('xc-auth', context.token)
      .expect(expectStatus);

    if (
      expectStatus === 200 &&
      response.body.count !== 137 &&
      response.body.dates.length !== 137
    ) {
      throw new Error('Wrong count');
    } else if (
      expectStatus === 400 &&
      response.body.msg !== 'View is not a calendar view'
    ) {
      throw new Error('Wrong error message');
    }
  };

  it('Count dates by range Calendar', async () => {
    await testCountDatesByRange(ViewTypes.CALENDAR);
  });

  it('Count dates by range GRID', async () => {
    await testCountDatesByRange(ViewTypes.GRID);
  });

  it('Count dates by range KANBAN', async () => {
    await testCountDatesByRange(ViewTypes.KANBAN);
  });
  it('Count dates by range FORM', async () => {
    await testCountDatesByRange(ViewTypes.FORM);
  });

  it('Count dates by range GALLERY', async () => {
    await testCountDatesByRange(ViewTypes.GALLERY);
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

  it('Test view column v3 apis', async function () {
    const table = new Model(
      await getTable({
        base: sakilaProject,
        name: 'film',
      }),
    );

    const view = await getView(context, {
      table,
      name: 'Film',
    });

    const columns = await table.getColumns(sakilaCtx);

    // get rows
    const rows = await listRow({
      base: sakilaProject,
      table: table,
      view,
      options: {
        limit: 1,
      },
    });

    // verify fields in response

    // hide few columns using update view column API
    // const view = await createView(context, {
    const columnsToHide = ['Rating', 'Description', 'ReleaseYear'];

    // generate key value pair of column id and object with hidden as true
    const viewColumnsObj: any = columnsToHide.reduce((acc, columnTitle) => {
      const column = columns.find((c) => c.title === columnTitle);
      if (column) {
        acc[column.id] = {
          show: false,
        };
      }
      return acc;
    }, {});

    await updateViewColumns(context, {
      view,
      viewColumns: viewColumnsObj,
    });

    // get rows after update
    const rowsAfterUpdate = await listRow({
      base: sakilaProject,
      table: table,
      view,
      options: {
        limit: 1,
      },
    });

    // verify column visible in old and hidden in new
    for (const title of columnsToHide) {
      expect(rows[0]).to.have.property(title);
      expect(rowsAfterUpdate[0]).to.not.have.property(title);
    }

    // get view columns and verify hidden columns
    const viewColApiRes: any = await getViewColumns(context, {
      view,
    });

    for (const colId of Object.keys(viewColApiRes[APIContext.VIEW_COLUMNS])) {
      const column = columns.find((c) => c.id === colId);
      if (columnsToHide.includes(column.title)) {
        expect(viewColApiRes[APIContext.VIEW_COLUMNS][colId]).to.have.property(
          'show',
        );
        expect(!!viewColApiRes[APIContext.VIEW_COLUMNS][colId].show).to.be.eq(
          false,
        );
      }
    }
  });
}

export default function () {
  describe('ViewRow', viewRowTests);
  describe('ViewRow', viewRowStaticTests);
}
