import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import setup from '../../../setup';

test.describe('Toolbar operations (GRID)', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  async function validateFirstRow(value: string) {
    await dashboard.grid.cell.verify({
      index: 0,
      columnHeader: 'Country',
      value: value,
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test('Group', async () => {
    await dashboard.treeView.openTable({ title: 'FilmList' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    // GroupBy Category Descending Order
    await toolbar.groupBy.add({ title: 'Category', ascending: false, locallySaved: false });

    // Verify Total Group Count
    await dashboard.grid.verifyTotalGroupCount({ count: 16 });

    //Open Group by indexMap
    await dashboard.grid.groupPage.openGroup({ indexMap: [0] });

    // Verify Row inside Group
    await dashboard.grid.groupPage.verifyRow({ indexMap: [0], rowIndex: 3 });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    // GroupBy Title field Ascending Order
    await toolbar.groupBy.add({ title: 'Title', ascending: true, locallySaved: false });

    // Close GroupBy Menu
    await toolbar.clickGroupBy();

    // Open Group
    await dashboard.grid.groupPage.openGroup({
      indexMap: [0, 1],
    });

    //Verify Group Header
    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0, 1],
      count: 1,
      title: 'Title',
    });

    // Verify Pagination Count
    await dashboard.grid.groupPage.verifyPagination({
      indexMap: [0, 1],
      count: 1,
    });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    //Remove All GroupBy Conditions
    await toolbar.groupBy.reset();
  });

  test('Hide, Sort, Filter', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: true,
    });

    // hide column
    await toolbar.fields.toggle({ title: 'LastUpdate' });
    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: false,
    });

    // un-hide column
    await toolbar.fields.toggle({ title: 'LastUpdate' });
    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: true,
    });

    await validateFirstRow('Afghanistan');
    // Sort column
    await toolbar.sort.add({ title: 'Country', ascending: false, locallySaved: false });
    await validateFirstRow('Zambia');

    // reset sort
    await toolbar.sort.reset();
    await validateFirstRow('Afghanistan');

    // Filter column
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Country',
      value: 'India',
      operation: 'is equal',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await validateFirstRow('India');

    // Reset filter
    await toolbar.filter.reset();
    await validateFirstRow('Afghanistan');

    await dashboard.closeTab({ title: 'Country' });
  });

  test('row height', async () => {
    // define an array of row heights
    const rowHeight = [
      { title: 'Short', height: '1.8rem' },
      { title: 'Medium', height: '3.6rem' },
      { title: 'Tall', height: '7.2rem' },
      { title: 'Extra', height: '10.8rem' },
    ];

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    // set row height & verify
    for (let i = 0; i < rowHeight.length; i++) {
      await toolbar.clickRowHeight();
      await toolbar.rowHeight.click({ title: rowHeight[i].title });
      await new Promise(resolve => setTimeout(resolve, 150));
      await dashboard.grid.rowPage.getRecordHeight(0).then(height => {
        expect(height).toBe(rowHeight[i].height);
      });
    }
  });
});
