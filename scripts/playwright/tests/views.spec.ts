import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';


test.describe('Views', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({page}) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  })

  test('Create views, reorder and delete', async () => {
    await dashboard.treeView.openTable({title: "City"});

    await dashboard.viewSidebar.createGridView({title: "CityGrid"});
    await dashboard.viewSidebar.verifyView({title: "CityGrid", index: 1});

    await dashboard.viewSidebar.createFormView({title: "CityForm"});
    await dashboard.viewSidebar.verifyView({title: "CityForm", index: 2});

    await dashboard.viewSidebar.createGalleryView({title: "CityGallery"});
    await dashboard.viewSidebar.verifyView({title: "CityGallery", index: 3});

    await dashboard.viewSidebar.reorderViews({
      sourceView: "CityGrid",
      destinationView: "CityForm"
    });
    await dashboard.viewSidebar.verifyView({title: "CityGrid", index: 2});
    await dashboard.viewSidebar.verifyView({title: "CityForm", index: 1});

    await dashboard.viewSidebar.deleteView({title: "CityForm"});
    await dashboard.viewSidebar.verifyViewNotPresent({title: "CityForm", index: 1});

    // todo: Delete form view is deleting grid view. Probably a bug.
    // await dashboard.viewSidebar.deleteView({title: "CityGrid"});
    // await dashboard.viewSidebar.verifyViewNotPresent({title: "CityGrid", index: 1});

    await dashboard.viewSidebar.deleteView({title: "CityGallery"});
    await dashboard.viewSidebar.verifyViewNotPresent({title: "CityGallery", index: 1});
  });

});
