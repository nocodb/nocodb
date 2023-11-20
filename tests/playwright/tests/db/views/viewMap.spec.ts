import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';

import setup, { unsetup } from '../../../setup';

test.describe.skip('Map View', () => {
  let dashboard: DashboardPage;
  let context: any;

  const latitudeInFullDecimalLength = '50.4501000';
  const longitudeInFullDecimalLength = '30.5234000';

  const latitudeInShortDecimalLength = '50.4501';
  const longitudeInShortDecimalLength = '30.5234';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);

    await dashboard.viewSidebar.changeBetaFeatureToggleValue();

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Actor' });

    const grid = dashboard.grid;

    await grid.column.create({
      title: 'Actors Birthplace',
      type: 'GeoData',
    });

    await grid.column.verify({ title: 'Actors Birthplace', isVisible: true });

    await grid.cell.geoData.openSetLocation({
      index: 0,
      columnHeader: 'Actors Birthplace',
    });
    await grid.cell.geoData.enterLatLong({
      lat: latitudeInShortDecimalLength,
      long: longitudeInShortDecimalLength,
    });
    await grid.cell.geoData.clickSave();

    await grid.cell.verifyGeoDataCell({
      index: 0,
      columnHeader: 'Actors Birthplace',
      lat: latitudeInFullDecimalLength,
      long: longitudeInFullDecimalLength,
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('shows the marker and opens the expanded form view when clicking on it', async () => {
    await dashboard.viewSidebar.createMapView({
      title: 'Map 1',
    });
    // Zoom out
    await dashboard.map.zoomOut(8);
    await dashboard.map.verifyMarkerCount(1);

    await dashboard.map.clickAddRowButton();

    await dashboard.expandedForm.fillField({
      columnTitle: 'FirstName',
      value: 'Mario',
      type: 'text',
    });

    await dashboard.expandedForm.fillField({
      columnTitle: 'LastName',
      value: 'Ali',
      type: 'text',
    });

    await dashboard.expandedForm.fillField({
      columnTitle: 'Actors Birthplace',
      value: '12, 34',
      type: 'geodata',
    });

    await dashboard.expandedForm.save();

    await dashboard.map.verifyMarkerCount(2);

    await dashboard.map.clickMarker('12', '34');

    await dashboard.expandedForm.clickDeleteRow();
    await dashboard.map.verifyMarkerCount(1);
  });
});
