import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

test.describe('Virtual columns', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Lookup', async () => {
    const countryList = ['Spain', 'Saudi Arabia', 'United Arab Emirates', 'Mexico', 'Turkey'];
    const cityCount = ['1', '3', '1', '2', '1'];

    await dashboard.treeView.openTable({ title: 'City', baseTitle: context.base.title });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Lookup',
      type: 'Lookup',
      childTable: 'Country',
      childColumn: 'Country',
    });
    for (let i = 0; i < countryList.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Lookup',
        value: countryList[i],
      });
    }

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    // Create Rollup column
    await dashboard.grid.column.create({
      title: 'Rollup',
      type: 'Rollup',
      childTable: 'Cities',
      childColumn: 'CityId',
      rollupType: 'count',
    });
    for (let i = 0; i < countryList.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Rollup',
        value: cityCount[i],
      });
    }
  });

  test('Rollup as Links', async () => {
    const countryList = ['Spain', 'Saudi Arabia', 'United Arab Emirates', 'Mexico', 'Turkey'];
    const cityCount = ['1', '3', '1', '2', '1'];

    await dashboard.treeView.openTable({ title: 'Country' });

    // Create Rollup column with count function
    await dashboard.grid.column.create({
      title: 'RollupAsLinks',
      type: 'Rollup',
      childTable: 'Cities',
      childColumn: 'CityId',
      rollupType: 'count',
    });

    // Enable "Show as links" option
    await dashboard.grid.column.openEdit({ title: 'RollupAsLinks' });

    // Click the toggle for "Show rolled up count as links"
    await dashboard.rootPage.locator('text=Show count as links').click();

    // Save the column changes
    await dashboard.grid.column.save({ isUpdated: true });

    // Verify the rollup values are displayed correctly
    for (let i = 0; i < countryList.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'RollupAsLinks',
        value: cityCount[i],
      });
    }

    // Test rollup as links behavior: should work like LTAR cells
    // When rollup shows as links, it should behave like a Links cell
    // Use verifyVirtualCell with verifyChildList=true to test link clicking behavior
    await dashboard.grid.cell.verifyVirtualCell({
      index: 1, // Saudi Arabia with 3 cities
      columnHeader: 'RollupAsLinks',
      count: 3,
      verifyChildList: true, // This will click on the link text and verify child list opens
      options: { singular: 'Link', plural: 'Links' },
    });
  });
});
