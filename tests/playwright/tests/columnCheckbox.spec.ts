import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';

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
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test('Checkbox', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.createTable({ title: 'Sheet1' });

    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });
    await dashboard.grid.addNewRow({ index: 3, value: '1d' });
    await dashboard.grid.addNewRow({ index: 4, value: '1e' });
    await dashboard.grid.addNewRow({ index: 5, value: '1f' });

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
    await validateRowArray(['1b', '1d', '1e', '1a', '1c', '1f']);
    await toolbar.sort.reset();

    // sort descending & validate
    await toolbar.sort.add({
      title: 'checkbox',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['1a', '1c', '1f', '1b', '1d', '1e']);
    await toolbar.sort.reset();

    // TBD: Add more tests
    // Expanded form insert
    // Expanded record insert
    // Expanded form insert
  });
});
