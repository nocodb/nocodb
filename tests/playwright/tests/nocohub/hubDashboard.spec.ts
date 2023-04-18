import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { NcContext } from '../../setup';
import setup from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';

test.describe('DashboardBasicTests', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let workspacePage: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    workspacePage = new WorkspacePage(page);
  });

  test('default workspace and home page links', async () => {
    // navigate to workspace page
    await dashboard.clickHome();

    // verify static elements : fixed menu items, buttons, etc.
    await workspacePage.verifyStaticElements();

    // verify run-time elements : dynamic menu items
    await workspacePage.LeftSideBar.verifyDynamicElements([
      { title: 'ws_pgExtREST0', role: 'owner' },
      { title: 'user', role: 'owner' },
    ]);

    // first row
    await workspacePage.Container.verifyDynamicElements({
      title: 'pgExtREST0',
      lastAccessed: 'a few seconds ago',
      role: 'Project Owner',
    });

    // TODO: Once implemented, verify page navigation & page specific elements
    //
    await workspacePage.Header.openMenu({ title: 'Workspaces' });
    await workspacePage.Header.openMenu({ title: 'Explore' });
    await workspacePage.Header.openMenu({ title: 'Help' });
    await workspacePage.Header.openMenu({ title: 'Community' });
  });
});
