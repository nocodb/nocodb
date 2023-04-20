import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';
import { LoginPage } from '../../pages/LoginPage';
import { SettingsPage, SettingTab } from '../../pages/Dashboard/Settings';
import { SignupPage } from '../../pages/SignupPage';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { AccountPage } from '../../pages/Account';

test.describe('Auth', () => {
  let context: any;
  let dashboard: DashboardPage;
  let settings: SettingsPage;
  let signupPage: SignupPage;
  let projectsPage: ProjectsPage;
  let accountPage: AccountPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    signupPage = new SignupPage(page);
    projectsPage = new ProjectsPage(page);
    accountPage = new AccountPage(page);

    settings = dashboard.settings;
  });

  test('Change password', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.gotoSettings();
    await settings.selectTab({ tab: SettingTab.TeamAuth });
    const url = await settings.teams.invite({
      email: 'user-1@nocodb.com',
      role: 'creator',
    });
    await settings.teams.closeInvite();
    await settings.close();

    await dashboard.signOut();

    await dashboard.rootPage.goto(url);
    await signupPage.signUp({
      email: 'user-1@nocodb.com',
      password: 'Password123.',
    });

    await projectsPage.openPasswordChangeModal();

    // Existing active pass incorrect
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: '123456789',
      newPass: '123456789',
      repeatPass: '123456789',
    });
    await accountPage.users.changePasswordPage.verifyFormError({ error: 'Current password is wrong' });

    // New pass and repeat pass mismatch
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: 'Password123.',
      newPass: '123456789',
      repeatPass: '987654321',
      networkValidation: false,
    });
    await accountPage.users.changePasswordPage.verifyPasswordDontMatchError();

    // All good
    await accountPage.users.changePasswordPage.changePassword({
      oldPass: 'Password123.',
      newPass: 'NewPasswordConfigured',
      repeatPass: 'NewPasswordConfigured',
      networkValidation: true,
    });

    const loginPage = new LoginPage(page);
    await loginPage.fillEmail({ email: 'user-1@nocodb.com' });
    await loginPage.fillPassword('NewPasswordConfigured');
    await loginPage.submit();

    await projectsPage.waitForRender();
  });
});
