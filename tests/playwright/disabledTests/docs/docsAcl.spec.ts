import { expect, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import { SignupPage } from '../../pages/SignupPage';
import { WorkspacePage } from '../../pages/WorkspacePage';
import setup, { NcContext } from '../../setup';
import { getDefaultPwd } from '../../tests/utils/general';

test.describe('Docs ACL', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Docs ACL Viewer', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.fillInviteEmail({
      email: 'test@example.com',
    });
    await dashboard.shareProjectButton.clickShareButton();
    await dashboard.shareProjectButton.copyInvitationLink();

    const inviteLink = await dashboard.getClipboardText();

    const newPage = await browserContent.newPage();

    await page.close();
    await newPage.goto(inviteLink);

    const workspace = new WorkspacePage(newPage);
    const signUp = new SignupPage(newPage);

    await workspace.logout();

    await newPage.goto(inviteLink);

    await signUp.signUp({
      email: 'test@example.com',
      password: getDefaultPwd(),
    });

    await workspace.baseOpen({ title: base.title });

    const newDashboard = new DashboardPage(newPage, base);

    await newDashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'test-page',
    });

    await newDashboard.shareProjectButton.verifyVisibility({ isVisible: false });
    await newDashboard.docs.openedPage.verifyTitleIsReadOnly({ editable: false });
    await newDashboard.docs.openedPage.verifyContentIsReadOnly({ editable: false });

    await newDashboard.sidebar.docsSidebar.verifyCreatePageButtonVisibility({
      isVisible: false,
      baseTitle: base.title as any,
    });
  });

  test('Docs ACL Editor', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.fillInviteEmail({
      email: 'test@example.com',
    });
    await dashboard.shareProjectButton.selectInviteRole({ role: 'editor' });
    await dashboard.shareProjectButton.clickShareButton();
    await dashboard.shareProjectButton.copyInvitationLink();

    const inviteLink = await dashboard.getClipboardText();

    const newPage = await browserContent.newPage();

    await page.close();
    await newPage.goto(inviteLink);

    const workspace = new WorkspacePage(newPage);
    const signUp = new SignupPage(newPage);

    await workspace.logout();

    await newPage.goto(inviteLink);

    await signUp.signUp({
      email: 'test@example.com',
      password: getDefaultPwd(),
    });

    await newPage.waitForTimeout(1000);

    await workspace.baseOpen({ title: base.title as any });

    const newDashboard = new DashboardPage(newPage, base);

    await newDashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'test-page',
    });

    await newDashboard.shareProjectButton.verifyVisibility({ isVisible: true });
    await newDashboard.docs.openedPage.verifyTitleIsReadOnly({ editable: true });
    await newDashboard.docs.openedPage.verifyContentIsReadOnly({ editable: true });

    await newDashboard.sidebar.docsSidebar.verifyCreatePageButtonVisibility({
      isVisible: true,
      baseTitle: base.title as any,
    });
  });

  test('Verify that access removal works', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.fillInviteEmail({
      email: 'test@example.com',
    });
    await dashboard.shareProjectButton.clickShareButton();
    await dashboard.shareProjectButton.copyInvitationLink();
    const inviteLink = await dashboard.getClipboardText();

    await dashboard.shareProjectButton.close();

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickManageAccess();
    await dashboard.shareProjectButton.verifyUserCount({ count: 1 });
    await dashboard.shareProjectButton.changeRole({
      email: 'test@example.com',
      role: 'Remove',
    });
    await dashboard.shareProjectButton.submitManageAccess();

    await dashboard.shareProjectButton.verifyUserCount({ count: 0 });
    await dashboard.shareProjectButton.verifyUserInList({
      email: 'test@example.com',
      isVisible: false,
    });

    const newPage = await browserContent.newPage();

    await page.close();
    await newPage.goto(inviteLink);

    const workspace = new WorkspacePage(newPage);
    const signUp = new SignupPage(newPage);

    await workspace.logout();

    await newPage.goto(inviteLink);

    await signUp.signUp({
      email: 'test@example.com',
      password: getDefaultPwd(),
    });

    expect(await workspace.workspaceCount()).toBe(0);
  });
});
