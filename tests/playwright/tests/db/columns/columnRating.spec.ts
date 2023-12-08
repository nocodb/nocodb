import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

test.describe('Rating - cell, filter, sort', () => {
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
      title: 'rating',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'Rating',
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
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Rating', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });

    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });
    await dashboard.grid.addNewRow({ index: 3, value: '1d' });
    await dashboard.grid.addNewRow({ index: 4, value: '1e' });
    await dashboard.grid.addNewRow({ index: 5, value: '1f' });

    // Create Rating column
    await dashboard.grid.column.create({
      title: 'rating',
      type: 'Rating',
    });

    // In cell insert
    await dashboard.grid.cell.rating.select({ index: 0, columnHeader: 'rating', rating: 2 });
    await dashboard.grid.cell.rating.select({ index: 2, columnHeader: 'rating', rating: 1 });
    await dashboard.grid.cell.rating.select({ index: 5, columnHeader: 'rating', rating: 0 });

    // column values
    // 1a : 3
    // 1b : 0
    // 1c : 2
    // 1d : 0
    // 1e : 0
    // 1f : 1

    // Filter column
    await verifyFilter({ opType: '=', value: '3', result: ['1a'] });
    await verifyFilter({ opType: '!=', value: '3', result: ['1b', '1c', '1d', '1e', '1f'] });
    // await verifyFilter({ opType: 'is like', value: '2', result: ['1c'] });
    // await verifyFilter({ opType: 'is not like', value: '2', result: ['1a', '1b', '1d', '1e', '1f'] });
    // await verifyFilter({ opType: 'is null', result: [] });
    // await verifyFilter({ opType: 'is not null', result: ['1a', '1b', '1c', '1d', '1e', '1f'] });
    await verifyFilter({ opType: '>', value: '1', result: ['1a', '1c'] });
    await verifyFilter({ opType: '>=', value: '1', result: ['1a', '1c', '1f'] });
    await verifyFilter({ opType: '<', value: '1', result: [] });
    await verifyFilter({ opType: '<=', value: '1', result: ['1b', '1d', '1e', '1f'] });

    // Sort column
    await toolbar.sort.add({
      title: 'rating',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(['1b', '1d', '1e', '1f', '1c', '1a']);
    await toolbar.sort.reset();

    // sort descending & validate
    await toolbar.sort.add({
      title: 'rating',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['1a', '1c', '1f', '1b', '1d', '1e']);
    await toolbar.sort.reset();
  });
});
