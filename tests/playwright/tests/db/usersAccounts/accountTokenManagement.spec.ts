import { test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import { AccountTokenPage } from '../../../pages/Account/Token';
import setup, { unsetup } from '../../../setup';

test.describe('User roles', () => {
  let accountTokenPage: AccountTokenPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    accountPage = new AccountPage(page);
    accountTokenPage = new AccountTokenPage(accountPage);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create and Delete token', async () => {
    test.slow();
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    await accountTokenPage.goto();
    await accountTokenPage.createToken({ description: `nc_test_${parallelId} test token` });
    await accountTokenPage.deleteToken({ description: `nc_test_${parallelId} test token` });
  });
});
