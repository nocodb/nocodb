import { test } from '@playwright/test';
import { AccountPage } from '../pages/Account';
import { AccountUsersPage } from '../pages/Account/Users';
import { ProjectsPage } from '../pages/ProjectsPage';
import { SignupPage } from '../pages/SignupPage';
import setup from '../setup';

const roleDb = [
  { email: 'creator@nocodb.com', role: 'Organization Level Creator', url: '' },
  { email: 'viewer@nocodb.com', role: 'Organization Level Viewer', url: '' },
];

test.describe('User roles', () => {
  let accountUsersPage: AccountUsersPage;
  let accountPage: AccountPage;
  let signupPage: SignupPage;
  let projectsPage: ProjectsPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    accountPage = new AccountPage(page);
    accountUsersPage = new AccountUsersPage(accountPage);

    signupPage = new SignupPage(accountPage.rootPage);
    projectsPage = new ProjectsPage(accountPage.rootPage);
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
      await signupAndVerify(i);
      await accountPage.rootPage.reload({ waitUntil: 'networkidle' });
      await accountUsersPage.goto();
    }

    // update role
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.updateRole({
        email: roleDb[i].email,
        role: 'Organization Level Viewer',
      });
    }

    // delete user
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.deleteUser({
        email: roleDb[i].email,
      });
    }
  });

  // signup and verify create project button exist or not based on role
  async function signupAndVerify(roleIdx: number) {
    await accountPage.signOut();

    await accountPage.rootPage.goto(roleDb[roleIdx].url);

    await signupPage.signUp({
      email: roleDb[roleIdx].email,
      password: 'Password123.',
    });

    await projectsPage.checkProjectCreateButton({
      exists: roleDb[roleIdx].role === 'Organization Level Creator',
    });
  }
});
