import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import { AccountSettingsPage } from '../pages/Account/Settings';
import setup from '../setup';

test.describe('App settings', () => {
  let accountSettingsPage: AccountSettingsPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    accountPage = new AccountPage(page);
    accountSettingsPage = new AccountSettingsPage(accountPage);
  });

  test('Toggle invite only signup', async () => {
    test.slow();

    await accountSettingsPage.goto();
    await accountSettingsPage.checkInviteOnlySignupCheckbox(false);
    await accountSettingsPage.toggleInviteOnlyCheckbox();
    await accountSettingsPage.checkInviteOnlySignupCheckbox(true);
    await accountSettingsPage.toggleInviteOnlyCheckbox();
    await accountSettingsPage.checkInviteOnlySignupCheckbox(false);
  });
});
