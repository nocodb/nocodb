import { test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import { AccountSettingsPage } from '../../../pages/Account/Settings';
import { SignupPage } from '../../../pages/SignupPage';
import setup, { unsetup } from '../../../setup';
import { getDefaultPwd } from '../../../tests/utils/general';

test.describe.skip('App settings', () => {
  // hub will not have this feature

  let accountSettingsPage: AccountSettingsPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    accountPage = new AccountPage(page);
    accountSettingsPage = accountPage.settings;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Toggle invite only signup', async () => {
    test.slow();

    await accountSettingsPage.goto({ networkValidation: false });

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
      password: getDefaultPwd(),
      expectedError: 'Not allowed to signup, contact super admin.',
    });

    await signupPage.rootPage.reload({ waitUntil: 'load' });

    await accountSettingsPage.goto({ networkValidation: false });

    await accountSettingsPage.checkInviteOnlySignupCheckbox(true);
    await accountSettingsPage.toggleInviteOnlyCheckbox();
    await accountSettingsPage.checkInviteOnlySignupCheckbox(false);

    await accountPage.signOut();

    await signupPage.goto();

    await signupPage.signUp({
      email: 'test-user-1@nocodb.com',
      password: getDefaultPwd(),
    });
  });
});
