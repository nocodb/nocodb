import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { LoginPage } from '../../../pages/LoginPage';
import { SignupPage } from '../../../pages/SignupPage';
import { ProjectsPage } from '../../../pages/ProjectsPage';
import { AccountPage } from '../../../pages/Account';
import { getDefaultPwd } from '../../../tests/utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';

// To enable after fixing it in hub
test.describe.skip('Auth', () => {
  let context: any;
  let dashboard: DashboardPage;
  let signupPage: SignupPage;
  let accountPage: AccountPage;
  let workspacePage: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    signupPage = new SignupPage(page);
    accountPage = new AccountPage(page);
    workspacePage = new WorkspacePage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Change password', async ({ page }) => {
    let url = '';
    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.clickShare();
    await dashboard.grid.toolbar.share.invite({ email: 'user-1@nocodb.com', role: 'creator' });
    url = await dashboard.grid.toolbar.share.getInvitationUrl();

    await dashboard.signOut();

    await dashboard.rootPage.goto(url);
    await signupPage.signUp({
      email: 'user-1@nocodb.com',
      password: getDefaultPwd(),
      withoutPrefix: true,
    });

    await workspacePage.openPasswordChangeModal();

    // Existing active pass incorrect
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: '123456789',
      newPass: '123456789',
      repeatPass: '123456789',
    });
    await accountPage.users.changePasswordPage.verifyFormError({ error: 'Current password is wrong' });

    // New pass and repeat pass mismatch
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: getDefaultPwd(),
      newPass: '123456789',
      repeatPass: '987654321',
      networkValidation: false,
    });
    await accountPage.users.changePasswordPage.verifyPasswordDontMatchError();

    // All good
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: getDefaultPwd(),
      newPass: 'NewPasswordConfigured',
      repeatPass: 'NewPasswordConfigured',
      networkValidation: true,
    });

    const loginPage = new LoginPage(page);
    await loginPage.fillEmail({ email: 'user-1@nocodb.com' });
    await loginPage.fillPassword('NewPasswordConfigured');
    await loginPage.submit();

    await workspacePage.waitForRender();
  });
});
