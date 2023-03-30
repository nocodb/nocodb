import { expect, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Create docs project and verify docs UI', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Shortcuts for page creation and verify sidebar on reload', async ({ page }) => {
    const sharedPage = await page.context().newPage();
    const sharedDashboard = new DashboardPage(sharedPage, context.project);

    await page.bringToFront();
    // // Single page share
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'root-single-page',
      content: 'root-single-page-content',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.verifySharePageToggle({ isPublic: true });
    const singlePageLink = await dashboard.shareProjectButton.getPublicPageLink();

    await dashboard.shareProjectButton.close();

    await sharedPage.bringToFront();
    await sharedPage.goto(singlePageLink);
    await sharedDashboard.docs.openedPage.verifyOpenedPageVisible();

    await sharedDashboard.docs.openedPage.verifyTitle({ title: 'root-single-page' });
    await sharedDashboard.docs.openedPage.verifyContent({ content: 'root-single-page-content' });
    await sharedDashboard.sidebar.docsSidebar.verifyVisibility({
      isVisible: false,
      projectTitle: project.title as any,
    });
    await sharedDashboard.shareProjectButton.verifyVisibility({ isVisible: false });
    await sharedDashboard.docs.openedPage.verifyPageOutlineOpened({ isOpened: true });
  });

  test('nested page share', async ({ page }) => {
    const sharedPage = await page.context().newPage();
    const sharedDashboard = new DashboardPage(sharedPage, context.project);

    await page.bringToFront();
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
      content: 'nested-root-single-page-content',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.sidebar.docsSidebar.createChildPage({
      projectTitle: project.title as any,
      parentTitle: 'nested-root-single-page',
      title: 'nested-child-single-page-1',
      content: 'nested-child-single-page-content-1',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.sidebar.docsSidebar.createChildPage({
      projectTitle: project.title as any,
      parentTitle: 'nested-root-single-page',
      title: 'nested-child-single-page-2',
      content: 'nested-child-single-page-content-2',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.verifySharePageToggle({ isPublic: true });
    const nestedPageLink = await dashboard.shareProjectButton.getPublicPageLink();

    await dashboard.shareProjectButton.close();

    await sharedPage.bringToFront();
    await sharedPage.goto(nestedPageLink);
    await sharedDashboard.docs.openedPage.verifyOpenedPageVisible();

    await sharedDashboard.docs.openedPage.verifyTitle({ title: 'nested-root-single-page' });
    await sharedDashboard.docs.openedPage.verifyContent({ content: 'nested-root-single-page-content' });
    await sharedDashboard.sidebar.docsSidebar.verifyVisibility({
      isVisible: true,
      projectTitle: project.title as any,
      isPublic: true,
    });
    await sharedDashboard.shareProjectButton.verifyVisibility({ isVisible: false });
    await sharedDashboard.docs.openedPage.verifyPageOutlineOpened({ isOpened: true });

    await sharedDashboard.sidebar.docsSidebar.verifyPageInSidebar({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
      level: 0,
      isPublic: true,
    });
    await sharedDashboard.sidebar.docsSidebar.verifyPageInSidebar({
      projectTitle: project.title as any,
      title: 'nested-child-single-page-1',
      level: 1,
      isPublic: true,
    });
    await sharedDashboard.sidebar.docsSidebar.verifyPageInSidebar({
      projectTitle: project.title as any,
      title: 'nested-child-single-page-2',
      level: 1,
      isPublic: true,
    });
  });
});
