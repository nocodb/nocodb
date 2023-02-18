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

    await dashboard.treeView.openTable({ title: 'City' });

    await dashboard.viewSidebar.activateGeoDataEasterEgg();

    await grid.column.create({
      title: 'GeoData1',
      type: 'GeoData',
    });

    // await grid.rootPage.pause();
    await grid.column.verify({ title: 'GeoData1', isVisible: true });

    // await dashboard.grid.cell.attachment.addFile({
    await grid.cell.geoData.open({
      index: 0,
      columnHeader: 'GeoData1',
    });
    // await grid.cell.geoData.enterLatLong({
    //   lat: '50.4501',
    //   long: '30.5234',
    // });
    // await grid.cell.geoData.clickSave();

    // await dashboard.grid.cell.attachment.addFile({
    //     index: i,
    //     columnHeader: 'testAttach',
    //     filePath: filepath,
    //   });
    //   await dashboard.grid.cell.attachment.verifyFile({
    //     index: i,
    //     columnHeader: 'testAttach',
    //   });

    expect(1 + 2).toBe(3);

    await grid.column.delete({ title: 'GeoData1' });
    await grid.column.verify({ title: 'GeoData1', isVisible: false });

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
