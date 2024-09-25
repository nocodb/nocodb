import { test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import { AccountTokenPage } from '../../../pages/Account/Token';
import setup, { unsetup } from '../../../setup';
import { Api } from 'nocodb-sdk';

test.describe('Token Management', () => {
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
    // Init SDK using token
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const apiTokens = await api.orgTokens.list();
    if (apiTokens.list.length > 0) {
      await api.orgTokens.delete(apiTokens.list[0].id);
    }

    test.slow();
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    await accountTokenPage.goto();
    await accountTokenPage.createToken({ description: `nc_test_${parallelId} test token` });
    await accountTokenPage.deleteToken({ description: `nc_test_${parallelId} test token` });
  });
});
