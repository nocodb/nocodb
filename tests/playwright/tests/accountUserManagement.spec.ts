import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import { AccountUsersPage } from '../pages/Account/Users';
import setup from '../setup';

const roleDb = [
  { email: 'creator@nocodb.com', role: 'Organization level creator', url: '' },
  { email: 'viewer@nocodb.com', role: 'Organization level viewer', url: '' },
];

test.describe('User roles', () => {
  let accountUsersPage: AccountUsersPage;
  let accountPage: AccountPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    accountPage = new AccountPage(page);
    accountUsersPage = new AccountUsersPage(accountPage);
  });

  test('Invite user, update role and delete user', async () => {
    test.slow();

    await accountUsersPage.goto();

    // invite user
    for (let i = 0; i < roleDb.length; i++) {
      roleDb[i].url = await accountUsersPage.invite({
        email: roleDb[i].email,
        role: roleDb[i].role,
      });
      await accountUsersPage.closeInvite();
    }

    // update role
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.updateRole({
        email: roleDb[i].email,
        role: 'Organization level viewer',
      });
    }

    // delete user
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.deleteUser({
        email: roleDb[i].email,
      });
    }
  });
});
