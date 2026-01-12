import 'mocha';
// @ts-ignore
import { expect } from 'chai';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import request from 'supertest';
import { createProject } from '../../factory/base';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
  updateViewColumn,
} from '../../factory/column';
import { createChildRow, createRow, getRow } from '../../factory/row';
import { createTable, getTable } from '../../factory/table';
import { createView } from '../../factory/view';
import init from '../../init';
import { getViewColumns, updateViewColumns } from '../../factory/viewColumns';
import {
  initCustomerTable,
  initFilmTable,
  initRentalTable,
  linkInitTables,
} from './viewRowInit';
import type View from '../../../../src/models/View';
import type Base from '../../../../src/models/Base';
import type { ColumnType } from 'nocodb-sdk';
import type Model from '../../../../src/models/Model';
let context: any;
let ctx: {
  workspace_id: string;
  base_id: string;
};

const isColumnsCorrectInResponse = (row: any, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const customerColumnsListStr = columns
    .map((c: ColumnType) => c.title)
    .sort()
    .join(',');
  return responseColumnsListStr === customerColumnsListStr;
};
// bases
let base: Base;
let customerTable: Model;
let filmTable: Model;
let rentalTable: Model;
let customerColumns: any;
let filmColumns: any;
let rentalColumns: any;
// views
let customerGridView: View;
let customerGalleryView: View;
let customerFormView: View;
// use film table because it has single select field
let filmKanbanView: View;
let rentalCalendarView: View;
let rentalCalendarView2: View;

function viewRowLocalStaticTests() {
  beforeEach(async function () {
    console.time('#### viewRowLocalTests');
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    customerTable = await initCustomerTable(context, base);
    customerColumns = await customerTable.getColumns(ctx);
    customerGridView = await createView(context, {
      title: 'Customer Grid',
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

    const _filmTable = await initFilmTable(context, base);
    filmTable = await getTable({
      base: base,
      name: _filmTable.table_name,
    });
    filmColumns = await filmTable.getColumns(ctx);
    filmKanbanView = await createView(context, {
      title: 'Film Kanban',
      table: filmTable,
      type: ViewTypes.KANBAN,
    });

    rentalTable = await initRentalTable(context, base);
    rentalColumns = await rentalTable.getColumns(ctx);
    rentalCalendarView = await createView(context, {
      title: 'Rental Calendar',
      table: rentalTable,
      type: ViewTypes.CALENDAR,
    });
    rentalCalendarView2 = await createView(context, {
      title: 'Rental Calendar 2',
      table: rentalTable,
      type: ViewTypes.CALENDAR,
      range: {
        fk_from_column_id: rentalColumns.find(
          (c: ColumnType) => c.title === 'RentalDate',
        )?.id,
      },
    });

    console.timeEnd('#### viewRowLocalTests');
  });

  //#region Get view row
  const testGetViewRowList = async (view: View) => {
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body.pageInfo;
    if (pageInfo.totalRows < 30 || response.body.list[0]['Id'] !== 1) {
      throw new Error('View row list is not correct');
    }
  };

  const testGetViewRowListKanban = async (view: View) => {
    const ratingColumn = filmColumns.find(
      (c: ColumnType) => c.column_name === 'rating',
    );

    if (!ratingColumn) {
      throw new Error('Rating column not found');
    }

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
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

  const testGetViewRowListCalendar = async (view: View) => {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${base.id}/${rentalTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const pageInfo = response.body.pageInfo;

    if (pageInfo.totalRows < 40 && response.body.list.length < 40) {
      throw new Error('Calendar View row list is not correct');
    }
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

  it('Get view row list Calendar', async () => {
    await testGetViewRowListCalendar(rentalCalendarView);
  });
  it('Get view row list Calendar2', async () => {
    await testGetViewRowListCalendar(rentalCalendarView2);
  });

  const testGetViewDataListWithRequiredColumns = async (view: View) => {
    const requiredColumns = customerColumns
      .filter(
        (c: ColumnType) =>
          ![
            UITypes.ForeignKey,
            // those additional uidts are
            // created automatically when not ext db
            UITypes.CreatedBy,
            UITypes.CreatedTime,
            UITypes.LastModifiedBy,
            UITypes.LastModifiedTime,
            UITypes.Order,
            UITypes.Meta,
          ].includes(c.uidt as UITypes),
      )
      .filter((_: any, index: number) => index < 2);
    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
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
      console.log(response.body.list[0], requiredColumns);
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
      .filter(
        (c: ColumnType) =>
          ![
            UITypes.ForeignKey,
            // those additional uidts are
            // created automatically when not ext db
            UITypes.CreatedBy,
            UITypes.CreatedTime,
            UITypes.LastModifiedBy,
            UITypes.LastModifiedTime,
            UITypes.Order,
            UITypes.Meta,
          ].includes(c.uidt as UITypes),
      )
      .filter((_: any, index: number) => index < 3);
    const ratingColumn = filmColumns.find(
      (c: ColumnType) => c.column_name === 'rating',
    );

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn?.id}`,
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
      Object.keys(
        response.body.find((e: any) => e.key === 'NC-17').value.list[0],
      )
        .sort()
        .join(','),
    ).to.equal('Description,Id,Title');
  };
  it('Get grouped view data list with required columns kanban', async () => {
    await testGetGroupedViewDataListWithRequiredColumns(filmKanbanView);
  });

  const testDescSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col: ColumnType) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn?.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
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

    // local test do not bring all data from sekila
    if (response.body.list[0][firstNameColumn.title] !== 'WILLIE') {
      console.log(response.body.list);
      throw new Error('Wrong sort');
    }

    const lastPageOffset =
      Math.trunc(pageInfo.totalRows / pageInfo.pageSize) * pageInfo.pageSize;
    const lastPageResponse = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
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
    const ratingColumn = filmColumns.find(
      (c: ColumnType) => c.title === 'Rating',
    );

    const titleColumn = filmColumns.find(
      (col: ColumnType) => col.title === 'Title',
    );

    const visibleColumns = [titleColumn];

    const sortInfo = [{ fk_column_id: titleColumn?.id, direction: 'desc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn?.id}`,
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
      response.body.find((e: any) => e.key === 'PG').value.list[0].Title,
    ).to.equal('WORST BANGER');
  };
  it('Get desc sorted table data list with required columns kanban', async function () {
    await testDescSortedGroupedViewDataList(filmKanbanView);
  });

  const testAscSortedViewDataList = async (view: View) => {
    const firstNameColumn = customerColumns.find(
      (col: ColumnType) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];
    const sortInfo = [{ fk_column_id: firstNameColumn?.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
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
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
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
      ] !== 'WILLIE'
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
    const ratingColumn = filmColumns.find(
      (c: ColumnType) => c.title === 'Rating',
    );

    const titleColumn = filmColumns.find(
      (col: ColumnType) => col.title === 'Title',
    );

    const visibleColumns = [titleColumn];

    const sortInfo = [{ fk_column_id: titleColumn?.id, direction: 'asc' }];

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn?.id}`,
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
      response.body.find((e: any) => e.key === 'PG')?.value.list[0].Title,
    ).to.equal('ACADEMY DINOSAUR');
  };
  it('Get asc sorted table data list with required columns kanban', async function () {
    await testAscSortedGroupedViewDataList(filmKanbanView);
  });

  //#endregion Get view row
}

function viewRowLocalTests() {
  beforeEach(async function () {
    console.time('#### viewRowLocalTests');
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    customerTable = await initCustomerTable(context, base);
    customerColumns = await customerTable.getColumns(ctx);

    const _filmTable = await initFilmTable(context, base);
    filmTable = await getTable({
      base: base,
      name: _filmTable.table_name,
    });
    filmColumns = await filmTable.getColumns(ctx);

    rentalTable = await initRentalTable(context, base);
    rentalColumns = await rentalTable.getColumns(ctx);

    await linkInitTables(context, base);
    console.timeEnd('#### viewRowLocalTests');
  });

  //#region Get row view
  const testGetViewDataListWithRequiredColumnsAndFilter = async (
    viewType: ViewTypes,
  ) => {
    const view = await createView(context, {
      title: 'View',
      table: rentalTable,
      type: viewType,
    });

    const lookupColumn = await createLookupColumn(context, {
      base: base,
      title: 'Lookup',
      table: rentalTable,
      relatedTableName: customerTable.table_name,
      relatedTableColumnTitle: 'FirstName',
    });
    // show column in gallery
    await updateViewColumns(context, {
      view,
      viewColumns: {
        [lookupColumn.id]: {
          show: true,
        },
      },
    });

    const nestedFilter = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          fk_column_id: lookupColumn?.id,
          logical_op: 'and',
          comparison_op: 'like',
          value: '%A%',
        },
      ],
    };

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${base.id}/${rentalTable.id}/views/${view.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([nestedFilter]),
      });

    expect(response.body.pageInfo.totalRows).greaterThan(0);

    const ascResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${base.id}/${rentalTable.id}/views/${view.id}`)
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
    expect(ascResponse.body.pageInfo.totalRows).greaterThan(0);
    expect(JSON.stringify(ascResponse.body.list[0][lookupColumn.title])).equal(
      JSON.stringify(['ANGELA']),
    );

    const descResponse = await request(context.app)
      .get(`/api/v1/db/data/noco/${base.id}/${rentalTable.id}/views/${view.id}`)
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

    expect(descResponse.body.pageInfo.totalRows).greaterThan(0);
    expect(JSON.stringify(descResponse.body.list[0][lookupColumn.title])).equal(
      JSON.stringify(['SUSAN']),
    );
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
      base: base,
      title: 'Number of rentals',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: rentalTable.table_name,
      relatedTableColumnTitle: 'RentalDate',
    });

    const activeColumn = (await customerTable.getColumns(ctx)).find(
      (c: ColumnType) => c.title === 'Active',
    );

    const nestedFields = {
      Rental: { fields: ['RentalDate', 'ReturnDate'] },
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
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}`,
      )
      .set('xc-auth', context.token)
      .query({
        nested: nestedFields,
        filterArrJson: JSON.stringify([nestedFilter]),
        sortArrJson: JSON.stringify([
          {
            fk_column_id: rollupColumn?.id,
            direction: 'desc',
          },
        ]),
      })
      .expect(200);

    expect(ascResponse.body.pageInfo.totalRows).greaterThan(10);

    if (parseInt(ascResponse.body.list[0][rollupColumn.title]) < 2) {
      throw new Error('Wrong filter');
    }

    expect(+ascResponse.body.list[0]['Rentals'].length).to.greaterThan(1);
  };

  it('Get nested sorted filtered table with nested fields data list with a rollup column in customer table view grid', async () => {
    await testGetNestedSortedFilteredTableDataListWithLookupColumn(
      ViewTypes.GRID,
    );
  });
  //#endregion Get row view

  //#region Create row view
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
  //#endregion Create row view

  //#region Update row view
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
  //#endregion Update row view

  //#region Update row view WithValidationAndInvalidData
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
  //#endregion Update row view WithValidationAndInvalidData

  // todo: Test webhooks of before and after update
  // todo: Test with form view

  //#region Update row view WithValidationAndValidData
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
  //#endregion Update row view WithValidationAndValidData

  //#region Delete row view
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
  //#endregion Delete row view

  //#region Delete row view WithForeignKeyConstraint
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
  //#endregion Delete row view WithForeignKeyConstraint

  //#region Find one tests
  const testFindOneSortedDataWithRequiredColumns = async (
    _viewType: ViewTypes,
  ) => {
    const table =
      _viewType === ViewTypes.CALENDAR ? rentalTable : customerTable;
    const view = await createView(context, {
      title: 'View',
      table: table,
      type: _viewType,
    });

    const firstNameColumn = customerColumns.find(
      (col: ColumnType) => col.title === 'FirstName',
    );
    const visibleColumns = [firstNameColumn];

    let response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}/find-one`,
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

    if (response.body[firstNameColumn.title] !== 'WILLIE') {
      console.log(response.body);
      throw new Error('Wrong sort');
    }

    response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}/find-one`,
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
    _viewType: ViewTypes,
  ) => {
    // TODO: Implement test logic
  };

  it('Find one view sorted filtered view with nested fields data list with a rollup column in customer table GRID', async function () {
    await testFindOneSortedFilteredNestedFieldsDataWithRollup(ViewTypes.GRID);
  });
  //#endregion Find one tests

  //#region Group by tests
  const testGroupDescSorted = async (_viewType: ViewTypes) => {
    const view = await createView(context, {
      title: 'View',
      table: customerTable,
      type: _viewType,
    });
    const firstNameColumn = customerColumns.find(
      (col: ColumnType) => col.title === 'FirstName',
    );

    const rollupColumn = await createRollupColumn(context, {
      base: base,
      title: 'Rollup',
      rollupFunction: 'count',
      table: customerTable,
      relatedTableName: rentalTable.table_name,
      relatedTableColumnTitle: 'RentalDate',
    });

    const visibleColumns = [firstNameColumn];
    const sortInfo = `-FirstName, +${rollupColumn.title}`;

    const response = await request(context.app)
      .get(
        `/api/v1/db/data/noco/${base.id}/${customerTable.id}/views/${view.id}/groupby`,
      )
      .set('xc-auth', context.token)
      .query({
        fields: visibleColumns.map((c) => c.title),
        sort: sortInfo,
        column_name: firstNameColumn.column_name,
      })
      .expect(200);

    if (
      response.body.list[0]['FirstName'] !== 'WILLIE' ||
      parseInt(response.body.list[0]['count']) !== 2
    )
      throw new Error('Wrong groupby');
  };

  it('Groupby desc sorted and with rollup view data list with required columns GRID', async function () {
    await testGroupDescSorted(ViewTypes.GRID);
  });

  it('Groupby desc sorted and with rollup view data list with required columns FORM', async function () {
    await testGroupDescSorted(ViewTypes.FORM);
  });

  it('Groupby desc sorted and with rollup view data list with required columns GALLERY', async function () {
    await testGroupDescSorted(ViewTypes.GALLERY);
  });

  it('Groupby desc sorted and with rollup view data list with required columns CALENDAR', async function () {
    await testGroupDescSorted(ViewTypes.CALENDAR);
  });

  const testGroupWithOffset = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
  };

  it('Groupby desc sorted and with rollup view data list with required columns GALLERY', async function () {
    await testGroupWithOffset(ViewTypes.GALLERY);
  });

  it('Groupby desc sorted and with rollup view data list with required columns FORM', async function () {
    await testGroupWithOffset(ViewTypes.FORM);
  });

  it('Groupby desc sorted and with rollup view data list with required columns GRID', async function () {
    await testGroupWithOffset(ViewTypes.GRID);
  });

  it('Groupby desc sorted and with rollup view data list with required columns CALENDAR', async function () {
    await testGroupWithOffset(ViewTypes.CALENDAR);
  });
  //#endregion Group by tests

  //#region Count tests
  const testCount = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
  };

  it('Count view data list with required columns', async function () {
    await testCount(ViewTypes.GRID);
    await testCount(ViewTypes.FORM);
    await testCount(ViewTypes.GALLERY);
    await testCount(ViewTypes.CALENDAR);
  });
  //#endregion Count tests

  //#region Read/Exist tests
  const testReadViewRow = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
  };

  it('Read view row', async function () {
    await testReadViewRow(ViewTypes.GALLERY);
    await testReadViewRow(ViewTypes.FORM);
    await testReadViewRow(ViewTypes.GRID);
    await testReadViewRow(ViewTypes.CALENDAR);
  });

  const testViewRowExists = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
  };

  it('Exist view row : should return true when row exists in view', async function () {
    await testViewRowExists(ViewTypes.GALLERY);
    await testViewRowExists(ViewTypes.GRID);
    await testViewRowExists(ViewTypes.FORM);
    await testViewRowExists(ViewTypes.CALENDAR);
  });

  const testViewRowNotExists = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
  };

  it("Exist view row : should return false when row doesn't exist in view", async function () {
    await testViewRowNotExists(ViewTypes.GALLERY);
    await testViewRowNotExists(ViewTypes.GRID);
    await testViewRowNotExists(ViewTypes.FORM);
    await testViewRowNotExists(ViewTypes.CALENDAR);
  });
  //#endregion Read/Exist tests

  //#region Calendar-specific tests
  const testCalendarDataApi = async () => {
    // TODO: Implement test logic
  };

  it('Calendar data', async function () {
    await testCalendarDataApi();
  });

  const testCountDatesByRange = async (_viewType: ViewTypes) => {
    // TODO: Implement test logic
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
  //#endregion Calendar-specific tests

  //#region Export tests
  it('Export csv GRID', async function () {
    // TODO: Implement test logic
  });
  //#endregion Export tests

  //#region View column API tests
  it('Test view column v3 apis', async function () {
    // TODO: Implement test logic
  });
  //#endregion View column API tests
}

export default function () {
  describe('ViewRowLocal', viewRowLocalStaticTests);
  describe('ViewRowLocal', viewRowLocalTests);
}
