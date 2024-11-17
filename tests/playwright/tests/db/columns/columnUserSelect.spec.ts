import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { Api } from 'nocodb-sdk';
import { isEE } from '../../../setup/db';
import { getDefaultPwd } from '../../utils/general';

const users: string[] = isEE()
  ? ['useree@nocodb.com', 'useree-0@nocodb.com', 'useree-1@nocodb.com', 'useree-2@nocodb.com', 'useree-3@nocodb.com']
  : ['user@nocodb.com', 'user-0@nocodb.com', 'user-1@nocodb.com', 'user-2@nocodb.com', 'user-3@nocodb.com'];

const roleDb = [
  { email: 'useree@nocodb.com', role: 'editor' },
  { email: 'useree-0@nocodb.com', role: 'editor' },
  { email: 'useree-1@nocodb.com', role: 'editor' },
  { email: 'useree-2@nocodb.com', role: 'editor' },
  { email: 'useree-3@nocodb.com', role: 'editor' },
];

async function beforeEachInit({ page }: { page: any }) {
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;

  const context: any = await setup({ page, isEmptyProject: true });
  const dashboard: DashboardPage = new DashboardPage(page, context.base);
  const api = context.api;

  if (isEE()) {
    workspacePage = new WorkspacePage(page);
    collaborationPage = workspacePage.collaboration;

    for (let i = 0; i < roleDb.length; i++) {
      try {
        await api.auth.signup({
          email: roleDb[i].email,
          password: getDefaultPwd(),
        });
      } catch (e) {
        // ignore error even if user already exists
      }
    }

    await dashboard.leftSidebar.clickTeamAndSettings();

    for (const user of roleDb) {
      await collaborationPage.addUsers(user.email, user.role);
    }
  }

  return { dashboard, context, api };
}

test.describe('User single select', () => {
  let dashboard: DashboardPage, grid: GridPage, topbar: TopbarPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page: page });
    context = initRsp.context;
    dashboard = initRsp.dashboard;
    api = initRsp.api;
    grid = dashboard.grid;
    topbar = dashboard.grid.topbar;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      {
        Id: 1,
        Title: `Row 0`,
      },
    ]);
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify the default option count, select default value and verify', async () => {
    if (!isEE()) {
      await grid.column.userOption.verifyDefaultValueOptionCount({ columnTitle: 'User', totalCount: 5 });
    }

    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: users[0],
      multiSelect: false,
    });

    // Verify default value is set
    await grid.column.userOption.verifySelectedOptions({
      columnHeader: 'User',
      options: [users[0]],
    });

    // Add new row and verify default value is added in new cell
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      {
        Id: 2,
        Title: `Row 1`,
      },
    ]);
    await grid.rootPage.reload();

    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[0],
      multiSelect: false,
    });
  });

  test('Rename column title and delete the column', async () => {
    // Rename column title, reload page and verify
    await grid.column.openEdit({ title: 'User' });
    await grid.column.fillTitle({ title: 'UserField' });
    await grid.column.save({
      isUpdated: true,
    });

    // reload page
    await dashboard.rootPage.reload();

    await grid.column.verify({ title: 'UserField', isVisible: true });

    // delete column and verify
    await grid.column.delete({ title: 'UserField' });
    await grid.column.verify({ title: 'UserField', isVisible: false });
  });

  test('Field operations - duplicate column, convert to SingleLineText', async () => {
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 2, Title: `Row 1` },
      { Id: 3, Title: `Row 2` },
      { Id: 4, Title: `Row 3` },
      { Id: 5, Title: `Row 4` },
      { Id: 6, Title: `Row 5` },
    ]);
    await grid.rootPage.reload();

    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: false });
    }

    await grid.column.duplicateColumn({
      title: 'User',
      expectedTitle: 'User copy',
    });

    // Verify duplicate column content
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verify({ index: i, columnHeader: 'User copy', option: users[i], multiSelect: false });
    }

    // Convert User field column to SingleLineText
    await grid.column.openEdit({ title: 'User copy' });
    await grid.column.selectType({ type: 'SingleLineText' });
    await grid.column.save({ isUpdated: true, typeChange: true });

    // Verify converted column content
    for (let i = 0; i <= 4; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'User copy', value: users[i] });
    }
  });

  test('Cell Operation - edit, copy-paste and delete', async () => {
    // set default user
    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: users[0],
      multiSelect: false,
    });

    // add 5 rows
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 2, Title: `Row 1` },
      { Id: 3, Title: `Row 2` },
      { Id: 4, Title: `Row 3` },
      { Id: 5, Title: `Row 4` },
      { Id: 6, Title: `Row 5` },
    ]);
    await grid.rootPage.reload();

    // Edit, refresh and verify
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: false });
    }

    // refresh page
    await topbar.clickRefresh();

    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verify({
        index: i,
        columnHeader: 'User',
        option: users[i],
        multiSelect: false,
      });
    }

    // Delete/clear cell, refresh and verify
    // #1 Using `Delete` keyboard button
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    // trigger delete button key
    await dashboard.rootPage.keyboard.press('Delete');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'user' });

    // #2 Using mouse click
    await grid.cell.userOption.clear({ index: 1, columnHeader: 'User', multiSelect: false });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 1, columnHeader: 'user' });

    // #3 Using `Cell Context Menu` right click `Clear` option
    await grid.clearWithMouse({ index: 2, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 2, columnHeader: 'user' });

    // Copy-paste
    // #1 Using keyboard
    await grid.cell.click({ index: 3, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press('Shift+ArrowDown');

    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+C' : 'Control+C');
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+V' : 'Control+V');

    await dashboard.rootPage.waitForTimeout(500);

    // refresh
    await topbar.clickRefresh();

    let counter = 3;
    for (let i = 0; i <= 1; i++) {
      await grid.cell.userOption.verify({
        index: i,
        columnHeader: 'User',
        option: users[counter],
        multiSelect: false,
      });
      counter++;
    }

    // #2 Using cell context menu copy paste option
    await grid.copyWithMouse({ index: 4, columnHeader: 'User' });
    await grid.pasteWithMouse({ index: 0, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verify({
      index: 0,
      columnHeader: 'User',
      option: users[4],
      multiSelect: false,
    });
  });
});

test.describe('User single select - filter, sort & GroupBy', () => {
  // Row values
  // only user@nocodb.com (row 0)
  // only user-0@nocodb.com (row 1)
  // only user-1@nocodb.com (row 2)
  // only user-2@nocodb.com (row 3)
  // only user-3@nocodb.com (row 4)

  // Example filters:
  //
  // where tags contains all of [user@nocodb.com]
  //   result: rows 0
  // where tags contains any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 0,1
  // where tags does not contain any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 2,3,4
  // where tags does not contain all of [user-0@nocodb.com]
  //   result: rows 0,2,3,4
  // where tags is not blank
  //   result: rows 0,1,2,3,4
  // where tags is blank
  //   result: null

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page: page });
    context = initRsp.context;
    dashboard = initRsp.dashboard;
    api = initRsp.api;
    grid = dashboard.grid;
    toolbar = dashboard.grid.toolbar;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 1, Title: `0` },
      { Id: 2, Title: `1` },
      { Id: 3, Title: `2` },
      { Id: 4, Title: `3` },
      { Id: 5, Title: `4` },
    ]);
    await page.reload();

    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: false });
    }
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
      title: 'User',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'User',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('User sort & validate, filter & validate', async () => {
    const ascendingOrderRowTitle = ['1', '2', '3', '4', '0'];
    const descendingOrderRowTitle = ['0', '4', '3', '2', '1'];

    // Sort ascending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(ascendingOrderRowTitle);
    await toolbar.sort.reset();

    // sort descending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(descendingOrderRowTitle);
    await toolbar.sort.reset();

    // filter
    await verifyFilter({ opType: 'contains all of', value: users[0], result: ['0'] });
    await verifyFilter({
      opType: 'contains any of',
      value: `${users[0]},${users[1]}`,
      result: ['0', '1'],
    });
    await verifyFilter({
      opType: 'does not contain any of',
      value: `${users[0]},${users[1]}`,
      result: ['2', '3', '4'],
    });
    await verifyFilter({ opType: 'does not contain all of', value: users[1], result: ['0', '2', '3', '4'] });
    await verifyFilter({ opType: 'is not blank', result: ['0', '1', '2', '3', '4'] });
    await verifyFilter({ opType: 'is blank', result: [] });

    //GroupBy
    // ascending order
    await toolbar.groupBy.add({ title: 'User', ascending: true, locallySaved: false });

    for (let i = 0; i <= 4; i++) {
      await dashboard.grid.groupPage.openGroup({ indexMap: [i] });

      await dashboard.grid.groupPage.validateFirstRow({
        indexMap: [i],
        rowIndex: 0,
        columnHeader: 'Title',
        value: ascendingOrderRowTitle[i],
      });
    }

    // descending order
    await toolbar.groupBy.update({ title: 'User', ascending: false, index: 0 });

    for (let i = 0; i <= 4; i++) {
      // await dashboard.grid.groupPage.openGroup({ indexMap: [i] });
      await dashboard.grid.groupPage.validateFirstRow({
        indexMap: [i],
        rowIndex: 0,
        columnHeader: 'Title',
        value: descendingOrderRowTitle[i],
      });
    }
    await toolbar.groupBy.remove({ index: 0 });
  });
});

test.describe('User multiple select', () => {
  let dashboard: DashboardPage, grid: GridPage, topbar: TopbarPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page: page });
    context = initRsp.context;
    dashboard = initRsp.dashboard;
    api = initRsp.api;
    grid = dashboard.grid;
    topbar = dashboard.grid.topbar;

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });
    await grid.column.userOption.allowMultipleUser({ columnTitle: 'User', allowMultiple: true });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'Sheet1').id;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify the default option count, select default value and verify', async () => {
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [{ Id: 1, Title: `Row 0` }]);
    await grid.rootPage.reload();

    if (!isEE()) {
      await grid.column.userOption.verifyDefaultValueOptionCount({ columnTitle: 'User', totalCount: 5 });
    }

    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: [users[0], users[1]],
      multiSelect: true,
    });

    // Verify default value is set
    await grid.column.userOption.verifySelectedOptions({
      columnHeader: 'User',
      options: [users[0], users[1]],
    });

    // Add new row and verify default value is added in new cell
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [{ Id: 2, Title: `Row 1` }]);
    await grid.rootPage.reload();

    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[0],
      multiSelect: true,
    });
    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[1],
      multiSelect: true,
    });
  });

  test('Field operations - duplicate column, convert to SingleLineText', async () => {
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 1, Title: `Row 0` },
      { Id: 2, Title: `Row 1` },
      { Id: 3, Title: `Row 2` },
      { Id: 4, Title: `Row 3` },
      { Id: 5, Title: `Row 4` },
    ]);
    await grid.rootPage.reload();

    let counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: true });
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[counter], multiSelect: true });

      if (counter === 4) counter = 0;
      else counter++;
    }

    await grid.column.duplicateColumn({
      title: 'User',
      expectedTitle: 'User copy',
    });

    // Verify duplicate column content
    counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verifySelectedOptions({
        index: i,
        columnHeader: 'User copy',
        options: [users[i], users[counter]],
      });

      if (counter === 4) counter = 0;
      else counter++;
    }

    // Convert User field column to SingleLineText
    await grid.column.openEdit({ title: 'User copy' });
    await grid.column.selectType({ type: 'SingleLineText' });
    await grid.column.save({ isUpdated: true, typeChange: true });

    // Verify converted column content
    counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'User copy', value: `${users[i]},${users[counter]}` });

      if (counter === 4) counter = 0;
      else counter++;
    }
  });

  test('Cell Operation - edit, copy-paste and delete', async () => {
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 1, Title: `Row 0` },
      { Id: 2, Title: `Row 1` },
      { Id: 3, Title: `Row 2` },
      { Id: 4, Title: `Row 3` },
      { Id: 5, Title: `Row 4` },
    ]);
    await grid.rootPage.reload();

    // Edit, refresh and verify
    let counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({
        index: i,
        columnHeader: 'User',
        option: users[i],
        multiSelect: true,
      });

      await grid.cell.userOption.select({
        index: i,
        columnHeader: 'User',
        option: users[counter],
        multiSelect: true,
      });
      if (counter === 4) counter = 0;
      else counter++;
    }

    // reload page
    await dashboard.rootPage.reload();

    counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verifySelectedOptions({
        index: i,
        columnHeader: 'User',
        options: [users[i], users[counter]],
      });
      if (counter === 4) counter = 0;
      else counter++;
    }

    // Delete/clear cell, refresh and verify
    // #1 Using `Delete` keyboard button
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    // trigger delete button key
    await dashboard.rootPage.keyboard.press('Delete');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'user' });

    // #2 Using mouse click
    await grid.cell.userOption.clear({ index: 1, columnHeader: 'User', multiSelect: true });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 1, columnHeader: 'user' });

    // #3 Using `Cell Context Menu` right click `Clear` option
    await grid.clearWithMouse({ index: 2, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 2, columnHeader: 'user' });

    // Copy-paste
    // #1 Using keyboard
    await grid.cell.click({ index: 3, columnHeader: 'User' });

    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifySelectedOptions({
      index: 0,
      columnHeader: 'User',
      options: [users[3], users[4]],
    });

    // #2 Using cell context menu copy paste option
    await grid.copyWithMouse({ index: 4, columnHeader: 'User' });
    await grid.pasteWithMouse({ index: 1, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifySelectedOptions({
      index: 1,
      columnHeader: 'User',
      options: [users[4], users[0]],
    });
  });
});

test.describe('User multiple select - filter, sort & GroupBy', () => {
  // Row values
  // only user@nocodb.com (row 0)
  // user-0@nocodb.com and user-1@nocodb.com (row 1)
  // user-1@nocodb.com and user-2@nocodb.com (row 2)
  // user-2@nocodb.com and user-3@nocodb.com (row 3)
  // user-3@nocodb.com and user@nocodb.com (row 4)

  // Example filters:
  //
  // where tags contains all of [user-0@nocodb.com, user-1@nocodb.com]
  //   result: rows 1
  // where tags contains any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 0,1,4
  // where tags does not contain any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 2,3
  // where tags does not contain all of [user-0@nocodb.com]
  //   result: rows 0,2,3,4
  // where tags is not blank
  //   result: rows 0,1,2,3,4
  // where tags is blank
  //   result: null

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;
  let api: Api<any>;
  let tableId: string;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page: page });
    context = initRsp.context;
    dashboard = initRsp.dashboard;
    api = initRsp.api;
    grid = dashboard.grid;
    toolbar = dashboard.grid.toolbar;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });
    await grid.column.userOption.allowMultipleUser({ columnTitle: 'User', allowMultiple: true });

    const tables = await api.dbTable.list(context.base.id);
    tableId = tables.list.find((table: any) => table.title === 'sheet1').id;

    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Id: 1, Title: `0` },
      { Id: 2, Title: `1` },
      { Id: 3, Title: `2` },
      { Id: 4, Title: `3` },
      { Id: 5, Title: `4` },
    ]);
    await grid.rootPage.reload();

    let counter = 2;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: true });
      if (i !== 0) {
        await grid.cell.userOption.select({
          index: i,
          columnHeader: 'User',
          option: users[counter],
          multiSelect: true,
        });
        if (counter === 4) counter = 0;
        else counter++;
      }
    }
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
      title: 'User',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'User',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('User sort & validate, filter & validate', async () => {
    const ascendingOrderRowTitle = ['1', '2', '3', '4', '0'];
    const descendingOrderRowTitle = ['0', '4', '3', '2', '1'];

    // Sort ascending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(ascendingOrderRowTitle);
    await toolbar.sort.reset();

    // sort descending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(descendingOrderRowTitle);
    await toolbar.sort.reset();

    // filter
    await verifyFilter({ opType: 'contains all of', value: `${(users[1], users[2])}`, result: ['1'] });
    await verifyFilter({
      opType: 'contains any of',
      value: `${users[0]},${users[1]}`,
      result: ['0', '1', '4'],
    });
    await verifyFilter({
      opType: 'does not contain any of',
      value: `${users[0]},${users[1]}`,
      result: ['2', '3'],
    });
    await verifyFilter({ opType: 'does not contain all of', value: users[1], result: ['0', '2', '3', '4'] });
    await verifyFilter({ opType: 'is not blank', result: ['0', '1', '2', '3', '4'] });
    await verifyFilter({ opType: 'is blank', result: [] });

    //GroupBy
    // ascending order
    await toolbar.groupBy.add({ title: 'User', ascending: true, locallySaved: false });

    for (let i = 0; i <= 4; i++) {
      await dashboard.grid.groupPage.openGroup({ indexMap: [i] });
      await dashboard.grid.groupPage.validateFirstRow({
        indexMap: [i],
        rowIndex: 0,
        columnHeader: 'Title',
        value: ascendingOrderRowTitle[i],
      });
    }

    // descending order
    await toolbar.groupBy.update({ title: 'User', ascending: false, index: 0 });

    for (let i = 0; i <= 4; i++) {
      await dashboard.grid.groupPage.validateFirstRow({
        indexMap: [i],
        rowIndex: 0,
        columnHeader: 'Title',
        value: descendingOrderRowTitle[i],
      });
    }
    await toolbar.groupBy.remove({ index: 0 });
  });
});
