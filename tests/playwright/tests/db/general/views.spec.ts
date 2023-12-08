import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import setup, { unsetup } from '../../../setup';

test.describe('Views CRUD Operations', () => {
  let dashboard: DashboardPage;
  let context: any;
  let toolbar: ToolbarPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create views, reorder and delete', async () => {
    await dashboard.treeView.openTable({ title: 'City' });
    await dashboard.viewSidebar.createGridView({ title: 'CityGrid' });
    await dashboard.viewSidebar.verifyView({ title: 'CityGrid', index: 0 });
    await dashboard.viewSidebar.renameView({
      title: 'CityGrid',
      newTitle: 'CityGrid2',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'CityGrid2',
      index: 0,
    });

    await dashboard.viewSidebar.createFormView({ title: 'CityForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CityForm', index: 1 });
    await dashboard.viewSidebar.renameView({
      title: 'CityForm',
      newTitle: 'CityForm2',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'CityForm2',
      index: 1,
    });

    await dashboard.viewSidebar.createGalleryView({ title: 'CityGallery' });
    await dashboard.viewSidebar.verifyView({ title: 'CityGallery', index: 2 });
    await dashboard.viewSidebar.renameView({
      title: 'CityGallery',
      newTitle: 'CityGallery2',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'CityGallery2',
      index: 2,
    });

    await dashboard.viewSidebar.changeViewIcon({
      title: 'CityGallery2',
      icon: 'american-football',
      iconDisplay: '🏈',
    });

    // todo: Enable when view bug is fixed
    // await dashboard.viewSidebar.reorderViews({
    //   sourceView: "CityGrid",
    //   destinationView: "CityForm",
    // });
    // await dashboard.viewSidebar.verifyView({ title: "CityGrid", index: 2 });
    // await dashboard.viewSidebar.verifyView({ title: "CityForm", index: 1 });

    // await dashboard.viewSidebar.deleteView({ title: "CityForm2" });
    // await dashboard.viewSidebar.verifyViewNotPresent({
    //   title: "CityGrid2",
    //   index: 2,
    // });

    await dashboard.viewSidebar.deleteView({ title: 'CityForm2' });
    await dashboard.viewSidebar.verifyViewNotPresent({
      title: 'CityForm2',
      index: 1,
    });

    // fix index after enabling reorder test
    await dashboard.viewSidebar.deleteView({ title: 'CityGallery2' });
    await dashboard.viewSidebar.verifyViewNotPresent({
      title: 'CityGallery2',
      index: 0,
    });
  });

  test('Save search query for each table and view', async () => {
    await dashboard.treeView.openTable({ title: 'City' });

    await toolbar.searchData.verify('');
    await toolbar.searchData.get().fill('City-City');
    await toolbar.searchData.verify('City-City');

    await dashboard.viewSidebar.createGridView({ title: 'CityGrid' });
    await toolbar.searchData.verify('');
    await toolbar.searchData.get().fill('City-CityGrid');
    await toolbar.searchData.verify('City-CityGrid');

    await dashboard.viewSidebar.createGridView({ title: 'CityGrid2' });
    await toolbar.searchData.verify('');
    await toolbar.searchData.get().fill('City-CityGrid2');
    await toolbar.searchData.verify('City-CityGrid2');

    await dashboard.viewSidebar.openView({ title: 'CityGrid' });
    await dashboard.rootPage.waitForTimeout(1000);
    await toolbar.searchData.verify('City-CityGrid');

    await dashboard.treeView.openTable({ title: 'City' });
    await dashboard.rootPage.waitForTimeout(1000);
    await toolbar.searchData.verify('City-City');

    await dashboard.treeView.openTable({ title: 'Actor' });
    await toolbar.searchData.verify('');

    await dashboard.viewSidebar.createGridView({ title: 'ActorGrid' });
    await toolbar.searchData.verify('');
    await toolbar.searchData.get().fill('Actor-ActorGrid');
    await toolbar.searchData.verify('Actor-ActorGrid');

    await dashboard.treeView.openTable({ title: 'Actor' });
    await dashboard.rootPage.waitForTimeout(1000);
    await toolbar.searchData.verify('');

    await dashboard.treeView.openTable({ title: 'City', mode: '' });
    await toolbar.searchData.verify('City-City');
  });
});
