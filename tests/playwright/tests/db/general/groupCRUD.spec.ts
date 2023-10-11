import { Page, test } from '@playwright/test';
import setup from '../../../setup';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { createDemoTable } from '../../../setup/demoTable';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';
import { enableQuickRun } from '../../../setup/db';

const validateResponse = false;

async function undo({ page, dashboard }: { page: Page; dashboard: DashboardPage }) {
  const isMac = await dashboard.grid.isMacOs();

  if (validateResponse) {
    await dashboard.grid.waitForResponse({
      uiAction: () => page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
      responseJsonMatcher: json => json.pageInfo,
    });
  } else {
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');

    // allow time for undo to complete rendering
    await page.waitForTimeout(500);
  }
}

test.describe('GroupBy CRUD Operations', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage, toolbar: ToolbarPage, topbar: TopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    topbar = dashboard.grid.topbar;

    await createDemoTable({ context, type: 'groupBased', recordCnt: 400 });
    await page.reload();
  });

  test('Single GroupBy CRUD Operations', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'groupBased' });

    await toolbar.sort.add({ title: 'Sub_Group', ascending: true, locallySaved: false });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.add({ title: 'Category', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.openGroup({ indexMap: [2] });

    await dashboard.grid.groupPage.addNewRow({
      indexMap: [2],
      index: 10,
      columnHeader: 'Sub_Group',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });

    // kludge: refresh once did not work for some reason
    await topbar.clickRefresh();
    await topbar.clickRefresh();

    //await toolbar.sort.add({title: 'Sub_Group', ascending: true, locallySaved: true});

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Sub_Group',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });
    await dashboard.grid.groupPage.editRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Sub_Group',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await toolbar.sort.update({ index: 2, title: 'Sub_Group', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Sub_Group',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await dashboard.grid.groupPage.deleteRow({
      title: 'Sub_Group',
      indexMap: [2],
      rowIndex: 0,
    });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Sub_Group',
      value: 'Angola',
    });

    await undo({ page, dashboard });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Sub_Group',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });
  });

  test('Double GroupBy CRUD Operations', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'groupBased' });

    await toolbar.sort.add({ title: 'Sub_Category', ascending: true, locallySaved: false });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.add({ title: 'Category', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'Sub_Group', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.openGroup({ indexMap: [2, 0] });

    await dashboard.grid.groupPage.addNewRow({
      indexMap: [2, 0],
      index: 10,
      columnHeader: 'Sub_Category',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });

    // One Click did not work for some reason
    await topbar.clickRefresh();
    await topbar.clickRefresh();

    //await toolbar.sort.add({title: 'Sub_Group', ascending: true, locallySaved: true});

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0],
      rowIndex: 0,
      columnHeader: 'Sub_Category',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });
    await dashboard.grid.groupPage.editRow({
      indexMap: [2, 0],
      rowIndex: 0,
      columnHeader: 'Sub_Category',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await toolbar.sort.update({ index: 3, title: 'Sub_Category', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0],
      rowIndex: 0,
      columnHeader: 'Sub_Category',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await dashboard.grid.groupPage.deleteRow({
      title: 'Sub_Category',
      indexMap: [2, 0],
      rowIndex: 0,
    });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0],
      rowIndex: 0,
      columnHeader: 'Sub_Category',
      value: 'Afghanistan',
    });

    await undo({ page, dashboard });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0],
      rowIndex: 0,
      columnHeader: 'Sub_Category',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });
  });

  test('Three GroupBy CRUD Operations', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'groupBased' });

    await toolbar.sort.add({ title: 'Item', ascending: true, locallySaved: false });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.add({ title: 'Category', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'Sub_Group', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'Sub_Category', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.openGroup({ indexMap: [2, 0, 0] });

    await dashboard.grid.groupPage.addNewRow({
      indexMap: [2, 0, 0],
      index: 10,
      columnHeader: 'Item',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });

    // One Click did not work for some reason
    await topbar.clickRefresh();
    await topbar.clickRefresh();

    //await toolbar.sort.add({title: 'Sub_Group', ascending: true, locallySaved: true});

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0, 0],
      rowIndex: 0,
      columnHeader: 'Item',
      value: 'Aaaaaaaaaaaaaaaaaaaa',
    });
    await dashboard.grid.groupPage.editRow({
      indexMap: [2, 0, 0],
      rowIndex: 0,
      columnHeader: 'Item',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await toolbar.sort.update({ index: 4, title: 'Item', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0, 0],
      rowIndex: 0,
      columnHeader: 'Item',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });

    await dashboard.grid.groupPage.deleteRow({
      title: 'Item',
      indexMap: [2, 0, 0],
      rowIndex: 0,
    });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0, 0],
      rowIndex: 0,
      columnHeader: 'Item',
      value: 'Argentina',
    });

    await undo({ page, dashboard });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2, 0, 0],
      rowIndex: 0,
      columnHeader: 'Item',
      value: 'Zzzzzzzzzzzzzzzzzzz',
    });
  });

  test('Single GroupBy CRUD Operations - Links', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.add({ title: 'Actors', ascending: false, locallySaved: false });

    await dashboard.grid.groupPage.openGroup({ indexMap: [2] });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [2],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'ARABIA DOGMA',
    });
  });
});
