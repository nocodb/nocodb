import 'mocha';
// @ts-ignore
import { expect } from 'chai';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import request from 'supertest';
import { createProject } from '../../factory/base';
import { createColumn, createLtarColumn } from '../../factory/column';
import { createChildRow, createRow, getRow } from '../../factory/row';
import { createTable } from '../../factory/table';
import { createView } from '../../factory/view';
import init from '../../init';
import { initCustomerTable } from './viewRowInit';
import type View from '../../../../src/models/View';
import type Base from '~/models/Base';
import type { Model } from '~/models';
let context;
let ctx: {
  workspace_id: string;
  base_id: string;
};
// bases
let base: Base;
let customerTable: Model;
// views
let customerGridView: View;
let customerGalleryView: View;
let customerFormView: View;

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
    if (pageInfo.totalRows < 30 || response.body.list[0]['CustomerId'] !== 1) {
      throw new Error('View row list is not correct');
    }
  };

  // const testGetViewRowListKanban = async (view: View) => {
  //   const ratingColumn = filmColumns.find((c) => c.column_name === 'rating');

  //   const response = await request(context.app)
  //     .get(
  //       `/api/v1/db/data/noco/${base.id}/${filmTable.id}/views/${view.id}/group/${ratingColumn.id}`,
  //     )
  //     .set('xc-auth', context.token)
  //     .expect(200);

  //   expect(response.body).to.be.an('array');
  //   // PG, R, NC-17, G, PG-17, null (uncategorized)
  //   expect(response.body).to.be.have.length(6);
  //   expect(response.body[0]).to.have.property('key');
  //   expect(response.body[0]).to.have.property('value');
  //   expect(response.body[0])
  //     .to.have.property('value')
  //     .and.to.be.an('object')
  //     .and.to.have.property('list')
  //     .and.to.be.an('array');
  //   expect(response.body[0]).to.have.property('key').and.to.be.a('string');
  //   expect(response.body[0].value)
  //     .to.have.property('pageInfo')
  //     .and.to.be.an('object')
  //     .and.to.have.property('totalRows')
  //     .and.to.be.a('number');
  // };

  // const testGetViewRowListCalendar = async (view: View) => {
  //   const response = await request(context.app)
  //     .get(`/api/v1/db/data/noco/${base.id}/${rentalTable.id}/views/${view.id}`)
  //     .set('xc-auth', context.token)
  //     .expect(200);

  //   const pageInfo = response.body.pageInfo;

  //   if (pageInfo.totalRows !== 16044 && response.body.list.length !== 16044) {
  //     throw new Error('Calendar View row list is not correct');
  //   }
  // };

  it('Get view row list gallery', async () => {
    await testGetViewRowList(customerGalleryView);
  });
  // it('Get view row list kanban', async () => {
  //   await testGetViewRowListKanban(filmKanbanView);
  // });
  it('Get view row list form', async () => {
    await testGetViewRowList(customerFormView);
  });
  it('Get view row list grid', async () => {
    await testGetViewRowList(customerGridView);
  });

  // it('Get view row list Calendar', async () => {
  //   await testGetViewRowListCalendar(rentalCalendarView);
  // });

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
    console.timeEnd('#### viewRowLocalTests');
  });

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
}

export default function () {
  describe.only('ViewRowLocal', viewRowLocalStaticTests);
  describe('ViewRowLocal', viewRowLocalTests);
}
