import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { Api } from 'nocodb-sdk';

test.describe('Single select', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    api = context.api;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'SingleSelect', type: 'SingleSelect' });
    await grid.column.selectOption.addOptions({
      columnTitle: 'SingleSelect',
      options: ['Option 1', 'Option 2'],
    });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [{ Id: 1, Title: `Row 0` }]);
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Select and clear options and rename options', async () => {
    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });

    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 2' });
    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option 2' });

    await grid.cell.selectOption.clear({ index: 0, columnHeader: 'SingleSelect' });
    await grid.cell.click({ index: 0, columnHeader: 'SingleSelect' });

    await grid.column.selectOption.addOption({ index: 2, option: 'Option 3', columnTitle: 'SingleSelect' });

    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'SingleSelect',
      option: 'Option 3',
      ignoreDblClick: false,
    });
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

    await grid.column.selectOption.deleteOptionWithUndo({ index: 0, columnTitle: 'SingleSelect' });
    await grid.cell.selectOption.verifyOptions({
      index: 0,
      columnHeader: 'SingleSelect',
      options: ['Option 1', 'Option 2', 'Option 3'],
    });

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

  test('Add new option directly from cell', async () => {
    await grid.cell.selectOption.addNewOption({
      index: 0,
      columnHeader: 'SingleSelect',
      option: 'Option added from cell',
    });

    await grid.cell.selectOption.verify({ index: 0, columnHeader: 'SingleSelect', option: 'Option added from cell' });

    await grid.column.delete({ title: 'SingleSelect' });
  });
});

test.describe('Single select - filter & sort', () => {
  // Row values
  // no values (row ❶)
  // only Foo (row ❷)
  // only Bar (row ❸)
  // only Baz (row ❹)

  //   Example filters:
  //
  // where tags contains any of [Foo, Bar]
  //   result: rows 2,3
  // where tags does not contain any of [Foo, Bar]
  //   result: rows 1,4

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    grid = dashboard.grid;
    api = context.api;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'SingleSelect', type: 'SingleSelect' });
    await grid.column.selectOption.addOptions({
      columnTitle: 'SingleSelect',
      options: ['foo', 'bar', 'baz'],
    });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 1, Title: '1' },
      { Id: 2, Title: '2' },
      { Id: 3, Title: '3' },
      { Id: 4, Title: '4' },
    ]);
    await page.reload();

    await grid.cell.selectOption.select({ index: 1, columnHeader: 'SingleSelect', option: 'foo', multiSelect: false });
    await grid.cell.selectOption.select({ index: 2, columnHeader: 'SingleSelect', option: 'bar', multiSelect: false });
    await grid.cell.selectOption.select({ index: 3, columnHeader: 'SingleSelect', option: 'baz', multiSelect: false });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

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
      title: 'SingleSelect',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'SingleSelect',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('Select and clear options and rename options', async () => {
    // fix me! single select filter value doesn't support selecting multiple options
    // await verifyFilter({ opType: 'contains any of', value: 'foo,bar', result: ['2', '3'] });
    // await verifyFilter({ opType: 'does not contain any of', value: 'foo,bar', result: ['1', '4'] });

    // Sort column
    await toolbar.sort.add({
      title: 'SingleSelect',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(['1', '3', '4', '2']);
    await toolbar.sort.reset();

    // sort descending & validate
    await toolbar.sort.add({
      title: 'SingleSelect',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['2', '4', '3', '1']);
    await toolbar.sort.reset();
  });
});
