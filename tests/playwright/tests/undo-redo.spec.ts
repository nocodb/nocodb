import { expect, Page, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { Api, UITypes } from 'nocodb-sdk';
import { rowMixedValue } from '../setup/xcdb-records';
import { GridPage } from '../pages/Dashboard/Grid';

let dashboard: DashboardPage, grid: GridPage, context: any, api: Api<any>, records: Record<string, any>, table: any;

test.describe('Undo Redo', () => {
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    const toolbar: ToolbarPage = dashboard.grid.toolbar;
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Number',
        title: 'Number',
        uidt: UITypes.Number,
      },
      {
        column_name: 'Decimal',
        title: 'Decimal',
        uidt: UITypes.Decimal,
      },
      {
        column_name: 'Currency',
        title: 'Currency',
        uidt: UITypes.Currency,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'numberBased',
        title: 'numberBased',
        columns: columns,
      });
      const rowAttributes = [];
      for (let i = 0; i < 10; i++) {
        const row = {
          Number: rowMixedValue(columns[1], i),
          Decimal: rowMixedValue(columns[2], i),
          Currency: rowMixedValue(columns[3], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 100 });
    } catch (e) {
      console.log(e);
    }
  });

  async function verifyRecords(values: any[] = []) {
    // inserted values
    const expectedValues = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33, ...values];

    const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.project.id, table.id, {
      fields: ['Number'],
      limit: 100,
    });

    // verify if expectedValues are same as currentRecords
    expect(currentRecords.list.map(r => parseInt(r.Number))).toEqual(expectedValues);
  }

  async function undo({ page, values }: { page: Page; values: number[] }) {
    const isMac = await grid.isMacOs();
    await dashboard.grid.waitForResponse({
      uiAction: () => page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
      responseJsonMatcher: json => json.pageInfo,
    });
    await verifyRecords(values);
  }

  /**
    This change provides undo/redo on multiple actions over UI.

    Scope	      Actions
    ------------------------------
    Row	        Create, Update, Delete
    LTAR	      Link, Unlink
    Fields	    Show/hide, Reorder
    Sort	      Add, Update, Delete
    Filters	    Add, Update, Delete (Excluding Filter Groups)
    Row Height	Update
    Column width	Update
    View	      Rename
    Table	      Rename

  **/

  test('Row: Create, Update, Delete', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // Row.Create
    await grid.addNewRow({ index: 10, value: '333', columnHeader: 'Number', networkValidation: true });
    await grid.addNewRow({ index: 11, value: '444', columnHeader: 'Number', networkValidation: true });
    await verifyRecords([333, 444]);

    // Row.Update
    await grid.editRow({ index: 10, value: '555', columnHeader: 'Number', networkValidation: true });
    await grid.editRow({ index: 11, value: '666', columnHeader: 'Number', networkValidation: true });
    await verifyRecords([555, 666]);

    // Row.Delete
    await grid.deleteRow(10, 'Number');
    await grid.deleteRow(10, 'Number');
    await verifyRecords([]);

    // Undo : Row.Delete
    await undo({ page, values: [666] });
    await undo({ page, values: [555, 666] });

    // Undo : Row.Update
    await undo({ page, values: [555, 444] });
    await undo({ page, values: [333, 444] });

    // Undo : Row.Create
    await undo({ page, values: [333] });
    await undo({ page, values: [] });

    console.log('records', records);
  });
});
