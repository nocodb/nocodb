import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
let api: Api<any>;

test.describe('Checkbox - cell, filter, sort', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  // define validateRowArray function
  async function validateRowArray(value: string[]) {
    const length = value.length;
    for (let i = 0; i < length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Title',
        value: value[i],
      });
    }
  }

  async function verifyFilter(param: { opType: string; value?: string; result: string[] }) {
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'checkbox',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'Checkbox',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

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
        column_name: 'Title',
        title: 'Title',
        uidt: UITypes.SingleLineText,
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'Sheet-1',
        title: 'Sheet-1',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 6; i++) {
        const row = {
          Id: i + 1,
          Title: `1${String.fromCharCode(97 + i)}`,
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributes);
    } catch (e) {
      console.error(e);
    }

    // page reload
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Checkbox', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'Sheet-1' });

    // Create Checkbox column
    await dashboard.grid.column.create({
      title: 'checkbox',
      type: 'Checkbox',
    });

    // In cell insert
    await dashboard.grid.cell.checkbox.click({ index: 0, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.click({ index: 1, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.click({ index: 2, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.click({ index: 5, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.click({ index: 1, columnHeader: 'checkbox' });

    // verify checkbox state
    await dashboard.grid.cell.checkbox.verifyChecked({ index: 0, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.verifyChecked({ index: 2, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.verifyChecked({ index: 5, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.verifyUnchecked({ index: 1, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.verifyUnchecked({ index: 3, columnHeader: 'checkbox' });
    await dashboard.grid.cell.checkbox.verifyUnchecked({ index: 4, columnHeader: 'checkbox' });

    // column values
    // 1a : true
    // 1b : false
    // 1c : true
    // 1d : null
    // 1e : null
    // 1f : true

    // Filter column
    await verifyFilter({ opType: 'is checked', result: ['1a', '1c', '1f'] });
    await verifyFilter({ opType: 'is not checked', result: ['1b', '1d', '1e'] });
    // await verifyFilter({ opType: 'is equal', value: '0', result: ['1b', '1d', '1e'] });
    // await verifyFilter({ opType: 'is not equal', value: '1', result: ['1b', '1d', '1e'] });
    // await verifyFilter({ opType: 'is null', result: [] });
    // await verifyFilter({ opType: 'is not null', result: ['1a', '1b', '1c', '1d', '1e', '1f'] });

    // Sort column
    await toolbar.sort.add({
      title: 'checkbox',
      ascending: true,
      locallySaved: false,
    });

    for (let i = 0; i < 3; i++) {
      await dashboard.grid.cell.checkbox.verifyUnchecked({ index: i, columnHeader: 'checkbox' });
    }
    for (let i = 3; i < 6; i++) {
      await dashboard.grid.cell.checkbox.verifyChecked({ index: i, columnHeader: 'checkbox' });
    }

    await toolbar.sort.reset();

    // sort descending & validate
    await toolbar.sort.add({
      title: 'checkbox',
      ascending: false,
      locallySaved: false,
    });

    for (let i = 0; i < 3; i++) {
      await dashboard.grid.cell.checkbox.verifyChecked({ index: i, columnHeader: 'checkbox' });
    }
    for (let i = 3; i < 6; i++) {
      await dashboard.grid.cell.checkbox.verifyUnchecked({ index: i, columnHeader: 'checkbox' });
    }

    await toolbar.sort.reset();

    // TBD: Add more tests
    // Expanded form insert
    // Expanded record insert
    // Expanded form insert
  });
});
