import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { FormPage } from '../../../pages/Dashboard/Form';
import setup, { unsetup } from '../../../setup';

test.describe.skip('Mobile Mode', () => {
  let dashboard: DashboardPage;
  let context: any;
  let toolbar: ToolbarPage;
  let form: FormPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    form = dashboard.form;
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('activating and deactivating Mobile Mode results correct behavior', async () => {
    await dashboard.viewSidebar.changeBetaFeatureToggleValue();

    // in non-mobile mode, all menu items are visible
    await dashboard.verifyTeamAndSettingsLinkIsVisible();

    await dashboard.treeView.createTable({ title: 'test-table-for-mobile-mode', baseTitle: context.base.title });

    // and all toolbar items have icons AND text
    await toolbar.verifyFieldsButtonIsVisibleWithTextAndIcon();

    await dashboard.toggleMobileMode();

    // in mobile-mode, some menu items are hidden
    await dashboard.verifyTeamAndSettingsLinkIsNotVisible();

    // and toolbar items have icons but no text
    await toolbar.verifyFieldsButtonIsVisibleWithoutTextButIcon();

    // operations (like creating views, toolbar operations, open treeview for opening tables) still work as expected
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });

    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 1 });

    // verify form-view fields order
    await form.verifyFormViewFieldsOrder({
      fields: ['Country', 'LastUpdate', 'Cities'],
    });

    // reorder & verify
    await form.reorderFields({
      sourceField: 'LastUpdate',
      destinationField: 'Country',
    });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'Cities'],
    });

    await dashboard.treeView.openTable({ mobileMode: true, title: 'test-table-for-mobile-mode' });

    // changing back to non-mobile mode leads to the original appearance
    await dashboard.toggleMobileMode();
    await dashboard.verifyTeamAndSettingsLinkIsVisible();
    await toolbar.verifyFieldsButtonIsVisibleWithTextAndIcon();
  });
});
