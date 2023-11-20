import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { GridPage } from '../../../pages/Dashboard/Grid';

test.describe.skip('Geo Data column', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('creation, validation and deleting geo data column', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'City' });

    await dashboard.viewSidebar.changeBetaFeatureToggleValue();

    await grid.column.create({
      title: 'GeoData1',
      type: 'GeoData',
    });

    await grid.column.verify({ title: 'GeoData1', isVisible: true });

    await grid.cell.geoData.openSetLocation({
      index: 0,
      columnHeader: 'GeoData1',
    });
    await grid.cell.geoData.enterLatLong({
      lat: '50.4501',
      long: '30.5234',
    });
    await grid.cell.geoData.clickSave();

    await grid.cell.verifyGeoDataCell({
      index: 0,
      columnHeader: 'GeoData1',
      lat: '50.4501000',
      long: '30.5234000',
    });

    // Trying to change to value that is not valid
    await grid.cell.geoData.openLatLngSet({
      index: 0,
      columnHeader: 'GeoData1',
    });
    await grid.cell.geoData.enterLatLong({
      lat: '543210.4501',
      long: '30.5234',
    });
    await grid.cell.geoData.clickSave();

    // value should not be changed
    await grid.cell.verifyGeoDataCell({
      index: 0,
      columnHeader: 'GeoData1',
      lat: '50.4501000',
      long: '30.5234000',
    });

    await grid.column.delete({ title: 'GeoData1' });
    await grid.column.verify({ title: 'GeoData1', isVisible: false });

    await dashboard.closeTab({ title: 'City' });
  });
});
