import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { LoginPage } from '../../../pages/LoginPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { isEE } from '../../../setup/db';

// To be enabled after shared base is implemented
test.describe('Shared base', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: NcContext;
  let loginPage: LoginPage;

  async function roleTest(role: string) {
    // todo: Wait till the page is loaded
    await dashboard.rootPage.waitForTimeout(2000);

    // fix me! this is currently disabled
    // await dashboard.validateProjectMenu({
    //   role: role.toLowerCase(),
    //   mode: 'shareBase',
    // });

    await dashboard.treeView.openTable({ title: 'Country', mode: 'shareBase' });

    await dashboard.viewSidebar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await toolbar.verifyRoleAccess({
      role: role.toLowerCase(),
      mode: 'shareBase',
    });

    await dashboard.treeView.validateRoleAccess({
      role: role.toLowerCase(),
      mode: 'shareBase',
      context,
    });

    await dashboard.grid.verifyRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyRoleAccess({
      role: role.toLowerCase(),
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    loginPage = new LoginPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('#1', async () => {
    let url = '';
    // share button visible only if a table is opened
    await dashboard.treeView.openTable({ title: 'Country' });
    // if (!isEE()) {
    //   url = await dashboard.grid.topbar.getSharedBaseUrl({ role: 'editor', enableSharedBase: true });
    //
    //   await dashboard.rootPage.waitForTimeout(2000);
    //   // access shared base link
    //   await dashboard.signOut();
    //   await dashboard.rootPage.waitForTimeout(2000);
    //   // todo: Move this to a page object
    //   await dashboard.rootPage.goto(url);
    //
    //   await roleTest('editor');
    //
    //   await loginPage.signIn({
    //     email: `user-${process.env.TEST_PARALLEL_INDEX}@nocodb.com`,
    //     password: getDefaultPwd(),
    //     withoutPrefix: true,
    //   });
    //
    //   await dashboard.rootPage.waitForTimeout(1000);
    //
    //   if (isEE()) {
    //     await dashboard.grid.workspaceMenu.switchWorkspace({
    //       workspaceTitle: context.workspace.title,
    //     });
    //   }
    //
    //   await dashboard.treeView.openProject({ title: context.base.title, context });
    //   await dashboard.treeView.openTable({ title: 'Country' });
    // }

    url = await dashboard.grid.topbar.getSharedBaseUrl({ role: 'viewer', enableSharedBase: false });

    await dashboard.rootPage.waitForTimeout(2000);
    // access shared base link
    await dashboard.signOut();
    // todo: Move this to a page object
    await dashboard.rootPage.goto(url);

    await roleTest('viewer');
  });
});
