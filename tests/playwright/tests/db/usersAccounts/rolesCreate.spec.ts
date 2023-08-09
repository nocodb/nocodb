import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { SettingsPage, SettingTab } from '../../../pages/Dashboard/Settings';
import { SignupPage } from '../../../pages/SignupPage';
import { ProjectsPage } from '../../../pages/ProjectsPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { isHub } from '../../../setup/db';

const roleDb = [
  { email: 'creator@nocodb.com', role: 'creator', url: '' },
  { email: 'editor@nocodb.com', role: 'editor', url: '' },
  { email: 'commenter@nocodb.com', role: 'commenter', url: '' },
  { email: 'viewer@nocodb.com', role: 'viewer', url: '' },
];

test.describe.skip('User roles', () => {
  let dashboard: DashboardPage;
  let settings: SettingsPage;
  let signupPage: SignupPage;
  let projectsPage: ProjectsPage;
  let workspacePage: WorkspacePage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    settings = dashboard.settings;
    signupPage = new SignupPage(page);
    projectsPage = new ProjectsPage(page);
    workspacePage = new WorkspacePage(page);
  });

  test('Create role', async () => {
    if (isHub()) {
      // Hub related tests moved to projectCollaboration.spec.ts
      test.skip();
    }

    test.slow();

    if (isHub()) {
      for (let i = 0; i < roleDb.length; i++) {
        await dashboard.projectView.btn_share.click();
        roleDb[i].url = await settings.teams.invite({
          email: roleDb[i].email,
          role: roleDb[i].role,
        });
        console.log(roleDb[i].url);
      }
    } else {
      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });
      await dashboard.gotoSettings();
      await settings.selectTab({ tab: SettingTab.TeamAuth });
      for (let i = 0; i < roleDb.length; i++) {
        roleDb[i].url = await settings.teams.invite({
          email: roleDb[i].email,
          role: roleDb[i].role,
        });
        await settings.teams.closeInvite();
      }
      await settings.close();

      // configure access control
      await dashboard.gotoSettings();
      await settings.selectTab({
        tab: SettingTab.DataSources,
      });
      await settings.dataSources.openAcl();
      await settings.dataSources.acl.toggle({ table: 'Language', role: 'editor' });
      await settings.dataSources.acl.toggle({ table: 'Language', role: 'commenter' });
      await settings.dataSources.acl.toggle({ table: 'Language', role: 'viewer' });
      await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'editor' });
      await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'commenter' });
      await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'viewer' });
      await settings.dataSources.acl.save();
      await settings.close();
    }

    // Role test
    for (let i = 0; i < roleDb.length; i++) {
      await roleTest(i);
    }
  });

  async function roleTest(roleIdx: number) {
    await roleSignup(roleIdx);
    if (isHub()) {
      await dashboard.validateWorkspaceMenu({
        role: roleDb[roleIdx].role,
      });
    } else {
      await dashboard.validateProjectMenu({
        role: roleDb[roleIdx].role,
      });
    }

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.toolbar.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.treeView.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    // Access control validation
    await dashboard.treeView.verifyTable({
      title: 'Language',
      exists: roleDb[roleIdx].role === 'creator' ? true : false,
    });
    await dashboard.treeView.verifyTable({
      title: 'CustomerList',
      exists: roleDb[roleIdx].role === 'creator' ? true : false,
    });

    // Project page validation
    await dashboard.clickHome();
    await projectsPage.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await projectsPage.openProject({
      title: context.project.title,
      waitForAuthTab: roleDb[roleIdx].role === 'creator',
      withoutPrefix: true,
    });
  }

  async function roleSignup(roleIdx: number) {
    await dashboard.signOut();

    await dashboard.rootPage.goto(roleDb[roleIdx].url);
    await signupPage.signUp({
      email: roleDb[roleIdx].email,
      password: getDefaultPwd(),
    });

    if (isHub()) {
      await workspacePage.projectOpen({ title: context.project.title });
    } else {
      await projectsPage.openProject({
        title: context.project.title,
        waitForAuthTab: roleDb[roleIdx].role === 'creator',
        withoutPrefix: true,
      });
    }

    // close 'Team & Auth' tab
    if (roleDb[roleIdx].role === 'creator') {
      await dashboard.closeTab({ title: 'Team & Auth' });
    }
  }
});
