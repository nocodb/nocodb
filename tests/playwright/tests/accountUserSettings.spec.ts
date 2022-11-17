import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import { AccountSettingsPage } from '../pages/Account/Settings';
import { SignupPage } from '../pages/SignupPage';
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

    // todo: remove after route navigation issue resolved
    await accountSettingsPage.rootPage.reload({ waitUntil: 'networkidle' });

    await accountSettingsPage.waitUntilContentLoads();

    // enable invite only signup
    if (!(await accountSettingsPage.getInviteOnlyCheckboxValue())) {
      await accountSettingsPage.toggleInviteOnlyCheckbox();
      await accountSettingsPage.checkInviteOnlySignupCheckbox(true);
    }

    await accountPage.signOut();

    const signupPage = new SignupPage(accountPage.rootPage);
    await signupPage.goto();

    await signupPage.signUp({
      email: 'test-user-1@nocodb.com',
      password: 'Password123.',
      expectedError: 'Not allowed to signup, contact super admin.',
    });

    await signupPage.rootPage.reload({ waitUntil: 'networkidle' });

    await accountSettingsPage.goto();

    await accountSettingsPage.waitUntilContentLoads();

    await accountSettingsPage.checkInviteOnlySignupCheckbox(true);
    await accountSettingsPage.toggleInviteOnlyCheckbox();
    await accountSettingsPage.checkInviteOnlySignupCheckbox(false);

    await accountPage.signOut();

    await signupPage.goto();

    await signupPage.signUp({
      email: 'test-user-1@nocodb.com',
      password: 'Password123.',
    });
  });
});
