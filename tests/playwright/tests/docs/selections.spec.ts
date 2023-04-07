import { test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
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

  test.only('Selection tests', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    const openedPage = dashboard.docs.openedPage;
    await openedPage.tiptap.fillContent({ content: 'test-content 1', index: 0 });
    await openedPage.tiptap.fillContent({ content: 'test-content 2', index: 1 });
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });

    await page.waitForTimeout(300);
    await openedPage.tiptap.clickTextFormatButton('bullet');
    await page.waitForTimeout(300);
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 0,
      content: 'test-content 1',
      level: 1,
      type: 'Bullet List',
    });
    await openedPage.tiptap.verifyListNode({
      index: 1,
      content: 'test-content 2',
      level: 1,
      type: 'Bullet List',
    });

    await openedPage.tiptap.selectNodes({ start: 0, end: 0 });
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyTextFormatButtonActive('bullet');

    await page.waitForTimeout(300);
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });

    await page.waitForTimeout(1200);
    await openedPage.tiptap.clickTextFormatButton('bullet');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyNode({
      content: 'test-content 1',
      type: 'Paragraph',
      index: 0,
    });
    await openedPage.tiptap.verifyListNode({
      index: 1,
      content: 'test-content 2',
      level: 1,
      type: 'Bullet List',
    });
  });
});
