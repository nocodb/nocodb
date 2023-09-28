import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';

test.describe('Table Column Operations', () => {
  let grid: GridPage, dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });
  });

  test('Create column', async () => {
    await grid.column.create({ title: 'column_name_a' });
    await grid.column.verify({ title: 'column_name_a' });

    await grid.column.openEdit({ title: 'column_name_a' });
    await grid.column.fillTitle({ title: 'column_name_b' });
    await grid.column.selectType({ type: 'LongText' });
    await grid.column.save({ isUpdated: true });
    await grid.column.verify({ title: 'column_name_b' });

    await grid.column.delete({ title: 'column_name_b' });
    await grid.column.verify({ title: 'column_name_b', isVisible: false });

    await grid.addNewRow({ index: 0, value: `Row 0` });
    await grid.verifyRow({ index: 0 });

    await grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: 'value_a',
    });
    await dashboard.expandedForm.save();
    await grid.cell.verify({
      index: 0,
      columnHeader: 'Title',
      value: 'value_a',
    });

    await grid.deleteRow(0);
    await grid.verifyRowDoesNotExist({ index: 0 });

    await grid.addNewRow({ index: 0, value: `Row 0` });
    await grid.addNewRow({ index: 1, value: `Row 1` });
    await grid.addNewRow({ index: 2, value: `Row 2` });
    await grid.addNewRow({ index: 3, value: `Row 3` });
    await grid.addNewRow({ index: 4, value: `Row 4` });
    await grid.deleteAll();

    await grid.verifyRowDoesNotExist({ index: 0 });

    // add new row using toolbar button
    await dashboard.grid.footbar.clickAddRecordFromForm();
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: 'value_a',
    });
    await dashboard.expandedForm.save();
    await grid.cell.verify({
      index: 0,
      columnHeader: 'Title',
      value: 'value_a',
    });

    // add new row using right-click menu
    // await grid.addRowRightClickMenu(0);
  });
});
