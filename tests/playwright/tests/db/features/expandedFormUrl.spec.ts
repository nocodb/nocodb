import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GalleryPage } from '../../../pages/Dashboard/Gallery';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

test.describe('Expanded form URL', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function viewTestTestTable(viewType: string) {
    await dashboard.treeView.createTable({
      title: 'Test Table',
      baseTitle: context.base.title,
    });
    await dashboard.grid.addNewRow({ index: 0 });

    let viewObj: GridPage | GalleryPage = dashboard.grid;
    if (viewType === 'grid') {
      viewObj = dashboard.grid;
    } else if (viewType === 'gallery') {
      viewObj = dashboard.gallery;
    }

    if (viewType === 'grid') {
      await dashboard.viewSidebar.createGridView({ title: 'Test Expand' });
    } else if (viewType === 'gallery') {
      await dashboard.viewSidebar.createGalleryView({
        title: 'Test Expand',
      });
    }

    // expand row & verify URL
    // New Expanded Modal don't have functionality to copy URL. Hence gettting URL from root page

    await viewObj.openExpandedRow({ index: 0 });
    const url = await dashboard.rootPage.url();
    await dashboard.expandedForm.escape();
    await dashboard.rootPage.goto(url);
  }

  async function viewTestSakila(viewType: string) {
    await dashboard.treeView.openTable({ title: 'Country' });

    let viewObj: GridPage | GalleryPage = dashboard.grid;
    if (viewType === 'grid') {
      viewObj = dashboard.grid;
    } else if (viewType === 'gallery') {
      viewObj = dashboard.gallery;
    }

    if (viewType === 'grid') {
      await dashboard.viewSidebar.createGridView({ title: 'CountryExpand' });
    } else if (viewType === 'gallery') {
      await dashboard.viewSidebar.createGalleryView({
        title: 'CountryExpand',
      });
      await viewObj.toolbar.clickFields();
      await viewObj.toolbar.fields.click({ title: 'Cities' });
      await viewObj.toolbar.clickFields();
    }

    // expand row & verify URL
    await viewObj.openExpandedRow({ index: 0 });

    // // verify copied URL in clipboard
    // await dashboard.expandedForm.copyUrlButton.click();
    // const expandedFormUrl = await dashboard.expandedForm.getClipboardText();
    // expect(expandedFormUrl).toContain("rowId=1");

    // access a new rowID using URL
    await dashboard.expandedForm.escape();
    await dashboard.expandedForm.gotoUsingUrlAndRowId({ rowId: '2' });

    await dashboard.expandedForm.escape();

    // visit invalid rowID
    await dashboard.expandedForm.gotoUsingUrlAndRowId({ rowId: '999' });
    await dashboard.verifyToast({ message: 'Record not found' });
    // ensure grid is displayed after invalid URL access
    // todo: Implement `verifyRowCount` method
    // await viewObj.verifyRowCount({ count: 25 });

    // Nested URL
    await dashboard.expandedForm.gotoUsingUrlAndRowId({ rowId: '1' });

    await dashboard.expandedForm.openChildCard({
      column: 'Cities',
      title: 'Kabul',
    });
    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.expandedForm.verifyCount({ count: 2 });

    // close child card
    await dashboard.expandedForm.close();
    await dashboard.childList.close();

    await dashboard.expandedForm.close();
  }

  test('Grid', async () => {
    await viewTestSakila('grid');
    await viewTestTestTable('grid');
  });

  test('Gallery', async () => {
    await viewTestSakila('gallery');
    await viewTestTestTable('gallery');
  });
});

test.describe('Expanded record duplicate & delete options', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Grid', async () => {
    await dashboard.treeView.openTable({ title: 'Actor' });

    // create filter to narrow down the number of records
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'FirstName',
      operation: 'is equal',
      value: 'NICK',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.verifyRowCount({ count: 3 });

    // expand row & duplicate
    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.clickDuplicateRow();
    await dashboard.expandedForm.save();
    await dashboard.grid.verifyRowCount({ count: 4 });

    // expand row & delete
    await dashboard.grid.openExpandedRow({ index: 3 });
    await dashboard.expandedForm.clickDeleteRow();
    await dashboard.expandedForm.escape();
    await dashboard.rootPage.reload();
    await dashboard.grid.verifyRowCount({ count: 3 });

    // expand row, duplicate & verify menu
    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.clickDuplicateRow();
    expect(await dashboard.expandedForm.isDisabledDeleteRow()).toBe(0);
    expect(await dashboard.expandedForm.isDisabledDuplicateRow()).toBe(0);
  });
});
