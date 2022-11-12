import { test } from '@playwright/test'
import { AccountPage } from '../pages/Account'
import { AccountUsersPage } from '../pages/Account/Users'
import setup from '../setup'

const roleDb = [
  { email: 'creator@nocodb.com', role: 'Organization level creator', url: '' },
  { email: 'viewer@nocodb.com', role: 'Organization level viewer', url: '' },
]

test.describe('User roles', () => {
  // let dashboard: DashboardPage;
  // let settings: SettingsPage;
  // let signupPage: SignupPage;
  let accountUsersPage: AccountUsersPage
  let accountPage: AccountPage
  let context: any

  test.beforeEach(async ({ page }) => {
    context = await setup({ page })
    accountPage = new AccountPage(page)
    accountUsersPage = new AccountUsersPage(accountPage)
  })

  test('Invite user', async () => {
    test.slow()

    await accountUsersPage.goto()

    for (let i = 0; i < roleDb.length; i++) {
      roleDb[i].url = await accountUsersPage.invite({
        email: roleDb[i].email,
        role: roleDb[i].role,
      });
      await accountUsersPage.closeInvite();
    }
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.getUserRow({
        email: roleDb[i].email,

      })
    }

    // close 'Team & Auth' tab
    // await dashboard.gotoSettings();
    // await settings.selectTab({ tab: SettingTab.TeamAuth });
    // for (let i = 0; i < roleDb.length; i++) {
    //   roleDb[i].url = await settings.teams.invite({
    //     email: roleDb[i].email,
    //     role: roleDb[i].role,
    //   });
    //   await settings.teams.closeInvite();
    // }
    // await settings.close();
    //
    // // configure access control
    // await dashboard.gotoSettings();
    // await settings.selectTab({
    //   tab: SettingTab.ProjectMetadata,
    //   subTab: SettingsSubTab.ACL,
    // });
    // await settings.acl.toggle({ table: 'Language', role: 'editor' });
    // await settings.acl.toggle({ table: 'Language', role: 'commenter' });
    // await settings.acl.toggle({ table: 'Language', role: 'viewer' });
    // await settings.acl.toggle({ table: 'CustomerList', role: 'editor' });
    // await settings.acl.toggle({ table: 'CustomerList', role: 'commenter' });
    // await settings.acl.toggle({ table: 'CustomerList', role: 'viewer' });
    // await settings.acl.save();
    // await settings.close();
    //
    // // Role test
    // for (let i = 0; i < roleDb.length; i++) {
    //   await roleTest(i);
    // }
  })
  //
  // async function roleTest(roleIdx: number) {
  //   await roleSignup(roleIdx);
  //   await dashboard.validateProjectMenu({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   await dashboard.treeView.openTable({ title: 'Country' });
  //
  //   await dashboard.viewSidebar.validateRoleAccess({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   await dashboard.grid.toolbar.validateRoleAccess({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   await dashboard.treeView.validateRoleAccess({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   await dashboard.grid.validateRoleAccess({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   await dashboard.grid.openExpandedRow({ index: 0 });
  //   await dashboard.expandedForm.validateRoleAccess({
  //     role: roleDb[roleIdx].role,
  //   });
  //
  //   // Access control validation
  //   await dashboard.treeView.verifyTable({
  //     title: 'Language',
  //     exists: roleDb[roleIdx].role === 'creator' ? true : false,
  //   });
  //   await dashboard.treeView.verifyTable({
  //     title: 'CustomerList',
  //     exists: roleDb[roleIdx].role === 'creator' ? true : false,
  //   });
  // }
  //
  // async function roleSignup(roleIdx: number) {
  //   await dashboard.signOut();
  //
  //   await dashboard.rootPage.goto(roleDb[roleIdx].url);
  //   await signupPage.signUp({
  //     email: roleDb[roleIdx].email,
  //     password: 'Password123.',
  //   });
  //
  //   await projectsPage.openProject({
  //     title: context.project.title,
  //     waitForAuthTab: roleDb[roleIdx].role === 'creator',
  //     withoutPrefix: true,
  //   });
  //
  //   // close 'Team & Auth' tab
  //   if (roleDb[roleIdx].role === 'creator') {
  //     await dashboard.closeTab({ title: 'Team & Auth' });
  //   }
  // }
})
