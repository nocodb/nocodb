import { test } from '@playwright/test';
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

  test('Update title page of root and child page and verify', async ({ page }) => {
    // Page update of root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'root-page' });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page',
      projectTitle: project.title as any,
    });

    await page.reload();

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page',
      projectTitle: project.title as any,
    });

    // Page update of child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page',
      projectTitle: project.title as any,
      title: 'child-page',
    });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page',
      projectTitle: project.title as any,
      level: 1,
    });

    await page.reload();

    await page.waitForTimeout(1500);

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page',
      projectTitle: project.title as any,
      level: 1,
    });

    // Verify that page title doesnt break when a new page is created, an existing page is opened and title is changed and new page is opened again and the title is updated there as well
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page',
      projectTitle: project.title as any,
    });

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'child-page',
      projectTitle: project.title as any,
    });
    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-1' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-1',
      projectTitle: project.title as any,
      level: 1,
    });

    await dashboard.sidebar.docsSidebar.openPage({ title: 'Page', projectTitle: project.title as any });
    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-2' });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-2',
      projectTitle: project.title as any,
      level: 1,
    });
  });

  test('Update emoji and content of newly created root page and child page', async () => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'root-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.sidebar.docsSidebar.selectEmoji({
      emoji: 'hot-dog',
      projectTitle: project.title as any,
      title: 'root-page',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'hot-dog',
      projectTitle: project.title as any,
      title: 'root-page',
    });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'hot-dog' });

    await dashboard.docs.openedPage.selectEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'rolling-on-the-floor-laughing',
      projectTitle: project.title as any,
      title: 'root-page',
    });

    await dashboard.docs.openedPage.fillTitle({ title: 'root-page-1' });
    await dashboard.docs.openedPage.fillContent({ content: 'root-page-1-content' });
    await dashboard.docs.openedPage.verifyContent({ content: 'root-page-1-content' });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page-1',
      projectTitle: project.title as any,
    });

    // child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page-1',
      projectTitle: project.title as any,
      title: 'child-page',
    });

    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-1' });
    await dashboard.docs.openedPage.fillContent({ content: 'child-page-1-content' });
    await dashboard.docs.openedPage.verifyContent({ content: 'child-page-1-content' });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      emoji: 'hot-dog',
      projectTitle: project.title as any,
      title: 'child-page-1',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'hot-dog',
      projectTitle: project.title as any,
      title: 'child-page-1',
    });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'hot-dog' });

    await dashboard.docs.openedPage.selectEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'rolling-on-the-floor-laughing',
      projectTitle: project.title as any,
      title: 'child-page-1',
    });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-1',
      projectTitle: project.title as any,
      level: 1,
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'root-page-1',
    });
    await dashboard.docs.openedPage.verifyContent({ content: 'root-page-1-content' });
    await dashboard.docs.openedPage.clearContent();
    await dashboard.docs.openedPage.fillContent({ content: 'new-root-page-1-content' });
    await dashboard.docs.openedPage.verifyContent({ content: 'new-root-page-1-content' });

    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'child-page-1',
    });
    await dashboard.docs.openedPage.verifyContent({ content: 'child-page-1-content' });
    await dashboard.docs.openedPage.clearContent();
    await dashboard.docs.openedPage.fillContent({ content: 'new-child-page-1-content' });
    await dashboard.docs.openedPage.verifyContent({ content: 'new-child-page-1-content' });
  });
});
