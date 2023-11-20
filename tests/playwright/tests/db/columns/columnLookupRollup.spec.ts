import { test } from '@playwright/test';
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
    // close 'Team & Auth' tab
    // await dashboard.closeTab({ title: "Team & Auth" });

    const countryList = ['Spain', 'Saudi Arabia', 'United Arab Emirates', 'Mexico', 'Turkey'];
    const cityCount = ['1', '3', '1', '2', '1'];

    await dashboard.treeView.openTable({ title: 'City' });
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
    await dashboard.closeTab({ title: 'City' });

    await dashboard.treeView.openTable({ title: 'Country' });
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
    await dashboard.closeTab({ title: 'Country' });
  });
});
