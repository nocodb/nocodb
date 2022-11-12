import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage, SettingTab } from '../pages/Dashboard/Settings';
import { SignupPage } from '../pages/SignupPage';

test.describe('Auth', () => {
  let dashboard: DashboardPage;
  let settings: SettingsPage;
  let context: any;
  let signupPage: SignupPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    signupPage = new SignupPage(page);
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

    await dashboard.openPasswordChangeModal();

    // Existing active pass incorrect
    await dashboard.changePassword({
      oldPass: '123456789',
      newPass: '123456789',
      repeatPass: '123456789',
    });
    await dashboard.rootPage
      .locator('[data-testid="nc-user-settings-form__error"]:has-text("Current password is wrong")')
      .waitFor();

    // New pass and repeat pass mismatch
    await dashboard.changePassword({
      oldPass: 'Password123.',
      newPass: '123456789',
      repeatPass: '987654321',
    });
    await dashboard.rootPage.locator('.ant-form-item-explain-error:has-text("Passwords do not match")').waitFor();

    // All good
    await dashboard.changePassword({
      oldPass: 'Password123.',
      newPass: 'NewPasswordConfigured',
      repeatPass: 'NewPasswordConfigured',
    });

    const loginPage = new LoginPage(page);
    await loginPage.fillEmail({ email: 'user-1@nocodb.com' });
    await loginPage.fillPassword('NewPasswordConfigured');
    await loginPage.submit();

    await page.locator('.nc-project-page-title:has-text("My Projects")').waitFor();
  });
});
