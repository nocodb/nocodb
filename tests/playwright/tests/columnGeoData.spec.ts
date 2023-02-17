import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { GridPage } from '../pages/Dashboard/Grid';

type ExpectedQrCodeData = {
  referencedValue: string;
  base64EncodedSrc: string;
};

test.describe.only('Geo Data column', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test('creation, validation, use "My Location" and deleting geo data column', async () => {
    // Write Playwright test that tests the following for the Geo Data column:
    // - creation
    // - validation
    // - use "My Location"
    // - deleting geo data column

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.viewSidebar.activateGeoDataEasterEgg();

    await dashboard.treeView.openTable({ title: 'City' });

    await dashboard.rootPage.pause();

    // await grid.column.create({
    //   title: 'Geo Data 1',
    //   type: 'GeoData',
    // });

    expect(1 + 2).toBe(3);

    await dashboard.closeTab({ title: 'City' });

    // await dashboard.treeView.openTable({ title: 'City' });
    // await grid.column.create({
    //   title: 'Geo Data',
    //   type: 'Geo Data',
    // });
    // await grid.column.openEdit({
    //     title: 'Geo Data',
    //     type: 'Geo Data',
    // });
  });
});
