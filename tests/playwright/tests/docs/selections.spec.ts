import { Page, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';
import { TextFormatType, TipTapNodes } from '../../pages/Dashboard/Docs/OpenedPage/Tiptap';

test.describe('Selection tests', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Selection tests: List items', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ projectTitle: project.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    const openedPage = dashboard.docs.openedPage;

    await openedPage.tiptap.clearContent();
    await verifyListItems(page, 'Bullet List', 'bullet');

    await openedPage.tiptap.clearContent();
    await verifyListItems(page, 'Numbered List', 'ordered');

    await openedPage.tiptap.clearContent();
    await verifyListItems(page, 'Task List', 'task');
  });

  async function verifyListItems(page: Page, nodeType: TipTapNodes, textFormatType: TextFormatType) {
    const openedPage = dashboard.docs.openedPage;
    await openedPage.tiptap.fillContent({ content: 'test-content 1', index: 0 });
    await openedPage.tiptap.fillContent({ content: 'test-content 2', index: 1 });
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });

    await page.waitForTimeout(300);
    await openedPage.tiptap.clickTextFormatButton(textFormatType);
    await page.waitForTimeout(300);
    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 0,
      content: 'test-content 1',
      level: 1,
      type: nodeType,
      nestedIndex: 0,
      checked: false,
    });
    await openedPage.tiptap.verifyListNode({
      index: 1,
      content: 'test-content 2',
      level: 1,
      type: nodeType,
      nestedIndex: 1,
      checked: false,
    });

    await openedPage.tiptap.selectNodes({ start: 0, end: 0 });
    await page.waitForTimeout(1200);
    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: textFormatType,
      active: true,
    });
    await openedPage.tiptap.clickTextFormatButton(textFormatType);

    await page.waitForTimeout(1000);

    await openedPage.tiptap.selectNodes({ start: 0, end: 0 });
    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: textFormatType,
      active: false,
    });

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
      type: nodeType,
      nestedIndex: 1,
      checked: false,
    });

    await openedPage.tiptap.selectNodes({ start: 0, end: 1 });
    await openedPage.tiptap.clickTextFormatButton(textFormatType);
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 0,
      content: 'test-content 1',
      level: 0,
      type: nodeType,
      nestedIndex: 0,
      checked: false,
    });
    await openedPage.tiptap.verifyNode({
      content: 'test-content 2',
      type: 'Paragraph',
      index: 1,
    });
  }
});
