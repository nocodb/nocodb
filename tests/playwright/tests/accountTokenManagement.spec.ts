import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import { AccountTokenPage } from '../pages/Account/Token';
import setup from '../setup';

test.describe('User roles', () => {
  let accountTokenPage: AccountTokenPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    accountPage = new AccountPage(page);
    accountTokenPage = new AccountTokenPage(accountPage);
  });

  test('Create and Delete token', async () => {
    test.slow();
    await accountTokenPage.goto();
    await accountTokenPage.createToken({ description: 'test token' });
    await accountTokenPage.deleteToken({ description: 'test token' });
  });
});
