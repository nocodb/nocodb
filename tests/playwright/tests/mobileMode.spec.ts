import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import setup from '../setup';

test.describe.only('Mobile Mode', () => {
  let dashboard: DashboardPage;
  let context: any;
  let toolbar: ToolbarPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    console.log('dashboard(in test.beforeEach)', dashboard);
    toolbar = dashboard.grid.toolbar;
  });

  // test('displays Toggle Mobile Mode menu item in correct location and with correct label', async () => {
  //   const mobileModeButton = await homePage.getMobileModeButton();
  //   expect(await mobileModeButton.isVisible()).toBeTruthy();
  //   expect(await mobileModeButton.innerText()).toEqual('Toggle Mobile Mode');
  // });

  test('activating and deactivating Mobile Mode results correct behavior', async () => {
    // in non-mobile mode, all menu items are visible
    await dashboard.verifyTeamAndSettingsLinkIsVisible();

    await dashboard.treeView.createTable({ title: 'test-table-for-mobile-mode' });

    // and all toolbar items have icons AND text
    await toolbar.verifyFieldsButtonIsVisibleWithTextAndIcon();

    // await dashboard.rootPage.pause();
    await dashboard.toggleMobileMode();
    // await dashboard.rootPage.pause();

    // in mobile-mode, some menu items are hidden
    await dashboard.verifyTeamAndSettingsLinkIsNotVisible();

    // and toolbar items have icons but no text
    await toolbar.verifyFieldsButtonIsVisibleWithoutTextButIcon();

    // toolbar items still work as expected

    // // changing back to non-mobile mode leads to the original appearance
    // await dashboard.verifyTeamAndSettingsLinkIsVisible();
    // await toolbar.verifyFieldsButtonIsVisibleWithTextAndIcon();
  });

  // test('changes appearance of menu bars when Toggle Mobile Mode is clicked', async () => {
  //   await homePage.toggleMobileMode();
  //   expect(await homePage.menuBarHasMobileModeAppearance()).toBeTruthy();
  // });

  // test('hides certain menu items and shows only icons in mobile mode', async () => {
  //   await homePage.toggleMobileMode();
  //   expect(await homePage.menuBarHasIconOnlyItems()).toBeTruthy();
  // });

  // test('performs expected actions when clicking menu items with hidden text in mobile mode', async () => {
  //   await homePage.toggleMobileMode();
  //   await homePage.clickFirstMobileMenuItem();
  //   expect(await homePage.getCurrentUrl()).toContain('/expected-url');
  // });

  // test('hides left Tables sidebar menu when clicking outside of the bar in mobile mode', async () => {
  //   await homePage.toggleMobileMode();
  //   await homePage.openTablesSidebarMenu();
  //   expect(await homePage.isTablesSidebarMenuOpen()).toBeTruthy();
  //   await homePage.clickOutsideTablesSidebarMenu();
  //   expect(await homePage.isTablesSidebarMenuOpen()).toBeFalsy();
  // });

  // test('restores original menu appearance and behavior when Toggle Mobile Mode is clicked again', async () => {
  //   await homePage.toggleMobileMode();
  //   await homePage.toggleMobileMode();
  //   expect(await homePage.menuBarHasOriginalAppearance()).toBeTruthy();
  //   expect(await homePage.menuBarHasFullTextItems()).toBeTruthy();
  // });

  //   test('FOOO', async () => {
  //     await dashboard.rootPage.pause();
  //     console.log('dashboard', dashboard);
  //   });

  //   test('Less menu items and no text for menu items', async () => {
  //     await dashboard.treeView.openTable({ title: 'City' });
  //     await dashboard.toggleMobileMode();
  //     await expect(2 + 2).toBe(4);
  //   });

  //   // test('Create views, reorder and delete', async () => {
  //   //   await dashboard.treeView.openTable({ title: 'City' });
  //   //   await dashboard.viewSidebar.createGridView({ title: 'CityGrid' });
  //   //   await dashboard.viewSidebar.verifyView({ title: 'CityGrid', index: 1 });
  //   //   await dashboard.viewSidebar.renameView({
  //   //     title: 'CityGrid',
  //   //     newTitle: 'CityGrid2',
  //   //   });
  //   //   await dashboard.viewSidebar.verifyView({
  //   //     title: 'CityGrid2',
  //   //     index: 1,
  //   //   });

  //   //   await dashboard.viewSidebar.createFormView({ title: 'CityForm' });
  //   //   await dashboard.viewSidebar.verifyView({ title: 'CityForm', index: 2 });
  //   //   await dashboard.viewSidebar.renameView({
  //   //     title: 'CityForm',
  //   //     newTitle: 'CityForm2',
  //   //   });
  //   //   await dashboard.viewSidebar.verifyView({
  //   //     title: 'CityForm2',
  //   //     index: 2,
  //   //   });

  //   //   await dashboard.viewSidebar.createGalleryView({ title: 'CityGallery' });
  //   //   await dashboard.viewSidebar.verifyView({ title: 'CityGallery', index: 3 });
  //   //   await dashboard.viewSidebar.renameView({
  //   //     title: 'CityGallery',
  //   //     newTitle: 'CityGallery2',
  //   //   });

  //   //   await dashboard.viewSidebar.verifyView({
  //   //     title: 'CityGallery2',
  //   //     index: 3,
  //   //   });

  //   //   await dashboard.viewSidebar.changeViewIcon({
  //   //     title: 'CityGallery2',
  //   //     icon: 'american-football',
  //   //   });

  //   //   // todo: Enable when view bug is fixed
  //   //   // await dashboard.viewSidebar.reorderViews({
  //   //   //   sourceView: "CityGrid",
  //   //   //   destinationView: "CityForm",
  //   //   // });
  //   //   // await dashboard.viewSidebar.verifyView({ title: "CityGrid", index: 2 });
  //   //   // await dashboard.viewSidebar.verifyView({ title: "CityForm", index: 1 });

  //   //   // await dashboard.viewSidebar.deleteView({ title: "CityForm2" });
  //   //   // await dashboard.viewSidebar.verifyViewNotPresent({
  //   //   //   title: "CityGrid2",
  //   //   //   index: 2,
  //   //   // });

  //   //   await dashboard.viewSidebar.deleteView({ title: 'CityForm2' });
  //   //   await dashboard.viewSidebar.verifyViewNotPresent({
  //   //     title: 'CityForm2',
  //   //     index: 2,
  //   //   });

  //   //   // fix index after enabling reorder test
  //   //   await dashboard.viewSidebar.deleteView({ title: 'CityGallery2' });
  //   //   await dashboard.viewSidebar.verifyViewNotPresent({
  //   //     title: 'CityGallery2',
  //   //     index: 1,
  //   //   });
  //   // });

  //   // test('Save search query for each table and view', async () => {
  //   //   await dashboard.treeView.openTable({ title: 'City' });

  //   //   await toolbar.searchData.verify('');
  //   //   await toolbar.searchData.get().fill('City-City');
  //   //   await toolbar.searchData.verify('City-City');

  //   //   await dashboard.viewSidebar.createGridView({ title: 'CityGrid' });
  //   //   await toolbar.searchData.verify('');
  //   //   await toolbar.searchData.get().fill('City-CityGrid');
  //   //   await toolbar.searchData.verify('City-CityGrid');

  //   //   await dashboard.viewSidebar.createGridView({ title: 'CityGrid2' });
  //   //   await toolbar.searchData.verify('');
  //   //   await toolbar.searchData.get().fill('City-CityGrid2');
  //   //   await toolbar.searchData.verify('City-CityGrid2');

  //   //   await dashboard.viewSidebar.openView({ title: 'CityGrid' });
  //   //   await expect(dashboard.get().locator('[data-testid="grid-load-spinner"]')).toBeVisible();
  //   //   await dashboard.grid.waitLoading();
  //   //   await toolbar.searchData.verify('City-CityGrid');

  //   //   await dashboard.viewSidebar.openView({ title: 'City' });
  //   //   await expect(dashboard.get().locator('[data-testid="grid-load-spinner"]')).toBeVisible();
  //   //   await dashboard.grid.waitLoading();
  //   //   await toolbar.searchData.verify('City-City');

  //   //   await dashboard.treeView.openTable({ title: 'Actor' });
  //   //   await toolbar.searchData.verify('');

  //   //   await dashboard.viewSidebar.createGridView({ title: 'ActorGrid' });
  //   //   await toolbar.searchData.verify('');
  //   //   await toolbar.searchData.get().fill('Actor-ActorGrid');
  //   //   await toolbar.searchData.verify('Actor-ActorGrid');

  //   //   await dashboard.viewSidebar.openView({ title: 'Actor' });
  //   //   await expect(dashboard.get().locator('[data-testid="grid-load-spinner"]')).toBeVisible();
  //   //   await dashboard.grid.waitLoading();
  //   //   await toolbar.searchData.verify('');

  //   //   await dashboard.treeView.openTable({ title: 'City', mode: '' });
  //   //   await toolbar.searchData.verify('City-City');
  //   // });
  // });
});
