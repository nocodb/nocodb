import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import setup from '../setup';
import { AccountLicensePage } from '../pages/Account/License';
import { DashboardPage } from '../pages/Dashboard';

test.describe('Enterprise License', () => {
  // @ts-ignore
  let dashboard: DashboardPage;
  // @ts-ignore
  let accountLicensePage: AccountLicensePage, accountPage: AccountPage, context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    accountPage = new AccountPage(page);
    accountLicensePage = new AccountLicensePage(accountPage);
    dashboard = new DashboardPage(page, context.project);
  });

  test('Update license key & verify if enterprise features enabled', async () => {
    test.slow();
    await accountLicensePage.goto();
    await accountLicensePage.saveLicenseKey('1234567890');

    await dashboard.goto();
    // presence of snowflake icon indicates enterprise features are enabled
    await dashboard.treeView.quickImport({ title: 'Snowflake' });
  });
});
