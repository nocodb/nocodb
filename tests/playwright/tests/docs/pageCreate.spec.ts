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

  test('Create root and child page and verify UI', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('test-page');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'test-page',
      projectTitle: project.title as any,
    });

    // child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'test-page',
      projectTitle: project.title as any,
    });

    await page.waitForTimeout(500);
    await page.keyboard.insertText('child-test-page');
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-test-page',
      projectTitle: project.title as any,
      level: 1,
    });
  });

  test('Shortcuts for page creation', async ({ page }) => {
    // root page
    await page.keyboard.press('Alt+N');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('parent');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'parent',
      projectTitle: project.title as any,
      level: 0,
    });

    await page.keyboard.press('Alt+M');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('child');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child',
      projectTitle: project.title as any,
      level: 1,
    });

    await page.keyboard.press('Alt+H');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('Parent 1');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'Parent 1',
      projectTitle: project.title as any,
      level: 0,
    });
  });
});
