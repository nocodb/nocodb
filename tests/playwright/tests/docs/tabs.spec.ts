import { expect, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs Tabs test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Tab open and close for pages/book', async ({ page }) => {
    await dashboard.verifyOpenedTab({ title: project.title as any });

    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });

    await dashboard.sidebar.docsSidebar.createChildPage({
      projectTitle: project.title as any,
      parentTitle: 'nested-root-single-page',
      title: 'nested-child-single-page',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();
    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page' });

    await dashboard.docs.openedPage.fillTitle({ title: 'new-nested-child-single-page' });
    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'cool-button',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'cool-button',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page', emoji: 'cool-button' });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page', emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'new-nested-child-single-page' });

    await dashboard.closeTab({ title: 'nested-child-single-page' });
    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'nested-root-single-page' });

    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
    });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page', emoji: 'rolling-on-the-floor-laughing' });

    await dashboard.closeTab({ title: 'nested-root-single-page' });
    await dashboard.verifyOpenedTab({ title: project.title as any });
    await dashboard.docs.pagesList.verifyProjectTitle({ title: project.title as any });

    // Delete verification

    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
    });
    await dashboard.verifyOpenedTab({ title: 'new-nested-child-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'new-nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.deletePage({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
    });

    await dashboard.verifyOpenedTab({ title: project.title as any });
    await dashboard.verifyTabIsNotOpened({ title: 'new-nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
    });

    // Reload verification
    await dashboard.sidebar.docsSidebar.openPage({
      projectTitle: project.title as any,
      title: 'nested-root-single-page',
    });

    // verify deleted page is not in sidebar
    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({
      projectTitle: project.title as any,
      title: 'new-nested-child-single-page',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'nested-root-single-page' });

    await page.reload();

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });

    await dashboard.sidebar.openProject({ title: project.title as any });
    await page.reload();

    await dashboard.verifyOpenedTab({ title: project.title });
  });
});
