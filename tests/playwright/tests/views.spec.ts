import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

test.describe('Views CRUD Operations', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Create views, reorder and delete', async () => {
    await dashboard.treeView.openTable({ title: 'City' });
    await dashboard.viewSidebar.createGridView({ title: 'CityGrid' });
    await dashboard.viewSidebar.verifyView({ title: 'CityGrid', index: 1 });
    await dashboard.viewSidebar.renameView({
      title: 'CityGrid',
      newTitle: 'CityGrid2',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'CityGrid2',
      index: 1,
    });

    await dashboard.viewSidebar.createFormView({ title: 'CityForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CityForm', index: 2 });
    await dashboard.viewSidebar.renameView({
      title: 'CityForm',
      newTitle: 'CityForm2',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'CityForm2',
      index: 2,
    });

    await dashboard.viewSidebar.createGalleryView({ title: 'CityGallery' });
    await dashboard.viewSidebar.verifyView({ title: 'CityGallery', index: 3 });
    await dashboard.viewSidebar.renameView({
      title: 'CityGallery',
      newTitle: 'CityGallery2',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'CityGallery2',
      index: 3,
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
      index: 2,
    });

    // fix index after enabling reorder test
    await dashboard.viewSidebar.deleteView({ title: 'CityGallery2' });
    await dashboard.viewSidebar.verifyViewNotPresent({
      title: 'CityGallery2',
      index: 1,
    });
  });
});
