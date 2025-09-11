import 'mocha';
// @ts-ignore
import { UITypes, ViewTypes } from 'nocodb-sdk';
import request from 'supertest';
import { createProject } from '../../factory/base';
import { createColumn, createLtarColumn } from '../../factory/column';
import { createChildRow, createRow, getRow } from '../../factory/row';
import { createTable } from '../../factory/table';
import { createView } from '../../factory/view';
import init from '../../init';
import type Base from '~/models/Base';

let context;
let ctx: {
  workspace_id: string;
  base_id: string;
};
// bases
let base: Base;

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
}

export default function () {
  describe('ViewRowLocal', viewRowLocalTests);
}
