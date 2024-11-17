import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { Api } from 'nocodb-sdk';
let api: Api<any>;
const addRecordUsingAPI = async (context: any, tableId: string, rowAttributes: any) => {
  try {
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, rowAttributes);
  } catch (e) {
    console.error(e);
  }
};

test.describe('Multi select', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'MultiSelect', type: 'MultiSelect' });
    await grid.column.selectOption.addOptions({
      columnTitle: 'MultiSelect',
      options: ['Option 1', 'Option 2'],
    });

    api = context.api;

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;
    await addRecordUsingAPI(context, tableId, [{ Id: 1, Title: `Row 0` }]);
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Select and clear options and rename options', async () => {
    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 1',
      multiSelect: true,
    });
    await grid.cell.selectOption.verify({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 1',
      multiSelect: true,
    });

    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 2',
      multiSelect: true,
    });
    await grid.cell.selectOption.verify({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 2',
      multiSelect: true,
    });

    await addRecordUsingAPI(context, tableId, [
      {
        Id: 2,
        Title: `Row 1`,
      },
    ]);
    await grid.rootPage.reload();

    await grid.cell.selectOption.select({
      index: 1,
      columnHeader: 'MultiSelect',
      option: 'Option 1',
      multiSelect: true,
    });

    await grid.cell.selectOption.clear({ index: 0, columnHeader: 'MultiSelect', multiSelect: true });
    await grid.cell.click({ index: 0, columnHeader: 'MultiSelect' });

    await grid.column.selectOption.addOption({ index: 2, option: 'Option 3', columnTitle: 'MultiSelect' });

    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 3',
      multiSelect: true,
    });
    await grid.cell.selectOption.verify({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 3',
      multiSelect: true,
    });

    await grid.column.selectOption.editOption({
      index: 2,
      columnTitle: 'MultiSelect',
      newOption: 'MultiSelect New Option 3',
    });
    await grid.cell.selectOption.verify({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'MultiSelect New Option 3',
      multiSelect: true,
    });

    await grid.cell.selectOption.verifyOptions({
      index: 0,
      columnHeader: 'MultiSelect',
      options: ['Option 1', 'Option 2', 'MultiSelect New Option 3'],
    });

    await grid.deleteRow(0);
    await grid.deleteRow(0);
    await grid.verifyRowDoesNotExist({ index: 0 });
  });

  test('Remove a option, reorder option and delete the column', async () => {
    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 1',
      multiSelect: true,
    });
    await grid.column.selectOption.addOption({ index: 2, option: 'Option 3', columnTitle: 'MultiSelect' });

    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 3',
      multiSelect: true,
    });
    await grid.cell.selectOption.verify({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 3',
      multiSelect: true,
    });

    await grid.column.selectOption.deleteOption({ index: 2, columnTitle: 'MultiSelect' });
    await grid.cell.selectOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'MultiSelect' });

    await grid.column.selectOption.reorderOption({
      sourceOption: 'Option 1',
      columnTitle: 'MultiSelect',
      destinationOption: 'Option 2',
    });
    await grid.cell.selectOption.verifyOptions({
      index: 0,
      columnHeader: 'MultiSelect',
      options: ['Option 2', 'Option 1'],
    });

    await grid.column.delete({ title: 'MultiSelect' });
  });

  test('Add new option directly from cell', async () => {
    await grid.cell.selectOption.addNewOption({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option added from cell 1',
      multiSelect: true,
    });

    await grid.cell.selectOption.addNewOption({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option added from cell 2',
      multiSelect: true,
    });

    await grid.cell.selectOption.verifySelectedOptions({
      index: 0,
      columnHeader: 'MultiSelect',
      options: ['Option added from cell 1', 'Option added from cell 2'],
    });

    await grid.column.delete({ title: 'MultiSelect' });
  });
});

test.describe('Multi select - filters', () => {
  // https://github.com/nocodb/nocodb/issues/534

  // Row values
  // no values (row ❶)
  // only Foo (row ❷)
  // only Bar (row ❸)
  // only Quux (row ❹)
  // Foo and Bar (row ❺)
  // Foo and Bar and Quux (row ❻)

  //   Example filters:
  //
  // where tags contains all of Foo
  //   result: rows ❷, ❺ and ❻
  // where tags contains any of Foo, Bar
  //   result: rows ❷, ❸, ❺ and ❻
  // where tags contains all of Foo, Bar
  //   result: rows ❺ and ❻
  // where tags is equal Foo, Bar
  //   result: row ❺
  // where tags is equal Bar
  //   result: row ❸
  // where tags is not null
  //   result: rows ❷, ❸, ❹, ❺ and ❻
  // where tags is null
  //   result: row ❶
  // where tags does not contain any of Quux
  //   result: rows ❶, ❷, ❸ and ❺

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'MultiSelect', type: 'MultiSelect' });
    await grid.column.selectOption.addOptions({
      columnTitle: 'MultiSelect',
      options: ['foo', 'bar', 'baz'],
    });

    const selectOptions = ['', 'foo', 'bar', 'baz', 'foo,bar', 'foo,bar,baz'];

    try {
      const tables = await api.dbTable.list(context.base.id);
      const rowAttributes = [];
      for (let i = 0; i < 6; i++) {
        const row = {
          Id: i + 1,
          Title: `${i + 1}`,
          MultiSelect: selectOptions[i],
        };
        rowAttributes.push(row);
      }

      const tableId = tables.list.find((table: any) => table.table_name === 'sheet1').id;
      await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, rowAttributes);
    } catch (e) {
      console.error(e);
    }

    // page reload
    await page.reload();
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
      title: 'MultiSelect',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'MultiSelect',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('Select and clear options and rename options', async () => {
    await verifyFilter({ opType: 'contains all of', value: 'foo', result: ['2', '5', '6'] });
    await verifyFilter({ opType: 'contains any of', value: 'foo,bar', result: ['2', '3', '5', '6'] });
    await verifyFilter({ opType: 'contains all of', value: 'foo,bar', result: ['5', '6'] });
    // await verifyFilter({ opType: 'is equal', value: 'foo,bar', result: ['5'] });
    // await verifyFilter({ opType: 'is equal', value: 'bar', result: ['3'] });
    // await verifyFilter({ opType: 'is not null', result: ['2', '3', '4', '5', '6'] });
    // await verifyFilter({ opType: 'is null', result: ['1'] });
    await verifyFilter({ opType: 'does not contain any of', value: 'baz', result: ['1', '2', '3', '5'] });

    // Sort column
    await toolbar.sort.add({
      title: 'MultiSelect',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(['1', '3', '4', '2', '5', '6']);
    await toolbar.sort.reset();

    // sort descending & validate
    await toolbar.sort.add({
      title: 'MultiSelect',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['6', '5', '2', '4', '3', '1']);
    await toolbar.sort.reset();
  });
});
