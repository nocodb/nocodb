import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { GridPage } from '../pages/Dashboard/Grid';
import setup from '../setup';

test.describe('Single select', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1' });

    await grid.column.create({ title: 'SingleSelect', type: 'SingleSelect' });
    await grid.addNewRow({ index: 0, value: 'Row 0' });
  });

  test('Select and clear options and rename options', async () => {
    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });

    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 2' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 2' });

    await grid.cell.selectOption.clear({ index: 0, columnHeader: 'SingleSelect' });
    await grid.cell.click({ index: 0, columnHeader: 'SingleSelect' });

    await grid.column.selectOption.addOption({ index: 2, option: 'Option 3', columnTitle: 'SingleSelect' });

    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 3' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 3' });

    await grid.column.selectOption.editOption({ index: 2, columnTitle: 'SingleSelect', newOption: 'New Option 3' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'New Option 3' });

    await grid.cell.selectOption.verifyOptions({
      index: 0,
      columnHeader: 'SingleSelect',
      options: ['Option 1', 'Option 2', 'New Option 3'],
    });

    await grid.deleteRow(0);
    await grid.verifyRowDoesNotExist({ index: 0 });
  });

  test('Remove a option, reorder option and delete the column', async () => {
    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });
    await grid.column.selectOption.addOption({ index: 2, option: 'Option 3', columnTitle: 'SingleSelect' });

    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 3' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 3' });

    await grid.column.selectOption.deleteOption({ index: 2, columnTitle: 'SingleSelect' });
    await grid.cell.selectOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'SingleSelect' });

    await grid.column.selectOption.reorderOption({
      sourceOption: 'Option 1',
      columnTitle: 'SingleSelect',
      destinationOption: 'Option 2',
    });
    await grid.cell.selectOption.verifyOptions({
      index: 0,
      columnHeader: 'SingleSelect',
      options: ['Option 2', 'Option 1'],
    });

    await grid.column.delete({ title: 'SingleSelect' });
  });
});
