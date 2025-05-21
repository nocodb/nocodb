import { test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import setup, { unsetup } from '../../../setup';
import { isEE } from '../../../setup/db';
import { AccountSetupPage } from '../../../pages/Account/Setup';

test.describe.serial('App setup', () => {
  // Org level roles are not available in EE
  if (isEE()) {
    test.skip();
  }

  // hub will not have this feature

  let accountSetupPage: AccountSetupPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetPlugins: true });
    accountPage = new AccountPage(page);
    accountSetupPage = accountPage.setup;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Configure email settings', async () => {
    await accountSetupPage.goto();
    await accountSetupPage.isConfigured('email', false);
    await accountSetupPage.configure({
      key: 'email',
      plugin: 'SMTP',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        username: 'test',
        password: 'test',
        name: 'gmail.com',
        from: 'test@gmail.com',
      },
    });
    await accountSetupPage.goto();
    await accountSetupPage.isConfigured('email', true);
    await accountSetupPage.resetConfig({
      key: 'email',
      plugin: 'SMTP',
    });
  });

  test('Configure storage settings', async () => {
    await accountSetupPage.goto();
    await accountSetupPage.isConfigured('storage', false);
    await accountSetupPage.configure({
      key: 'storage',
      plugin: 'S3',
      config: {
        bucket: 'test',
        region: 'us-east-1',
        access_key: 'test',
        access_secret: 'test',
      },
    });
    await accountSetupPage.goto();
    await accountSetupPage.isConfigured('storage', true);
    await accountSetupPage.resetConfig({
      key: 'storage',
      plugin: 'S3',
    });
  });
});
