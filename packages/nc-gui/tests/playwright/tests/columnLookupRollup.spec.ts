import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

test.describe('Virtual columns', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Lookup', async () => {
    // close 'Team & Auth' tab
    // await dashboard.closeTab({ title: "Team & Auth" });

    const pinCode = ['4166', '77459', '41136', '8268', '33463'];
    const cityCount = ['1', '3', '1', '2', '1'];

    await dashboard.treeView.openTable({ title: 'City' });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Lookup',
      type: 'Lookup',
      childTable: 'Address List',
      childColumn: 'PostalCode',
    });
    for (let i = 0; i < pinCode.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Lookup',
        value: pinCode[i],
      });
    }
    await dashboard.closeTab({ title: 'City' });

    await dashboard.treeView.openTable({ title: 'Country' });
    // Create Rollup column
    await dashboard.grid.column.create({
      title: 'Rollup',
      type: 'Rollup',
      childTable: 'City List',
      childColumn: 'City',
      rollupType: 'count',
    });
    for (let i = 0; i < pinCode.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Rollup',
        value: cityCount[i],
      });
    }
    await dashboard.closeTab({ title: 'Country' });
  });
});
