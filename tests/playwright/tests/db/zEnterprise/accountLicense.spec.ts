import { expect, test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import setup from '../../../setup';
import { AccountLicensePage } from '../../../pages/Account/License';
import { DashboardPage } from '../../../pages/Dashboard';
import { isHub } from '../../../setup/db';

test.describe.skip('Enterprise License', () => {
  // @ts-ignore
  let dashboard: DashboardPage;
  // @ts-ignore
  let accountLicensePage: AccountLicensePage, accountPage: AccountPage, context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    accountPage = new AccountPage(page);
    accountLicensePage = new AccountLicensePage(accountPage);
    dashboard = new DashboardPage(page, context.project);
  });

  test('Update license key & verify if enterprise features enabled', async () => {
    if (isHub()) {
      // Enterprise license is not applicable for hub
      test.skip();
    }

    test.slow();
    await accountLicensePage.goto();
    await accountLicensePage.saveLicenseKey('1234567890');

    await dashboard.goto();
    // presence of snowflake icon indicates enterprise features are enabled
    if (isHub()) {
      await dashboard.projectView.tab_dataSources.click();
      await dashboard.projectView.btn_addNewDataSource.click();
      const types = await dashboard.projectView.dataSources.getDatabaseTypeList();
      await expect(types).toContain('Snowflake');
    } else {
      await dashboard.treeView.quickImport({ title: 'Snowflake' });
    }
  });
});
