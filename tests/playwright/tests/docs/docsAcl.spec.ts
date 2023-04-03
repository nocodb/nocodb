import { expect, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import { LoginPage } from '../../pages/LoginPage';
import { SignupPage } from '../../pages/SignupPage';
import { WorkspacePage } from '../../pages/WorkspacePage';
import setup, { NcContext } from '../../setup';

test.describe('Docs ACL', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Docs ACL Viewer', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'test-page' });
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
      password: 'password123.',
    });

    await workspace.selectProject({ title: project.title as any });

    const newDashboard = new DashboardPage(newPage, project);

    await newDashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'test-page',
    });

    await newDashboard.shareProjectButton.verifyVisibility({ isVisible: false });
    await newDashboard.docs.openedPage.verifyTitleIsReadOnly({ editable: false });
    await newDashboard.docs.openedPage.verifyContentIsReadOnly({ editable: false });

    await newDashboard.sidebar.docsSidebar.verifyCreatePageButtonVisibility({
      isVisible: false,
      projectTitle: project.title as any,
    });
  });

  test('Docs ACL Editor', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'test-page' });
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
      password: 'password123.',
    });

    await workspace.selectProject({ title: project.title as any });

    const newDashboard = new DashboardPage(newPage, project);

    await newDashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'test-page',
    });

    await newDashboard.shareProjectButton.verifyVisibility({ isVisible: true });
    await newDashboard.docs.openedPage.verifyTitleIsReadOnly({ editable: true });
    await newDashboard.docs.openedPage.verifyContentIsReadOnly({ editable: true });

    await newDashboard.sidebar.docsSidebar.verifyCreatePageButtonVisibility({
      isVisible: true,
      projectTitle: project.title as any,
    });
  });

  test('Verify that access removal works', async ({ page, context: browserContent }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'test-page' });
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
      password: 'password123.',
    });

    await workspace.verifyWorkspaceCount({
      count: 0,
    });
  });
});
