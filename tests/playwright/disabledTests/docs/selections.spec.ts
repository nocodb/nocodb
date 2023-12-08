import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';
import { TextFormatType, TipTapNodes } from '../../pages/Dashboard/Docs/OpenedPage/Tiptap';

test.describe('Selection tests', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Selection tests: List items', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
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

  test('Selection tests: Text format (Bold, Italic, Underline, Strike, Link', async ({ page }) => {
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    const openedPage = dashboard.docs.openedPage;

    await openedPage.tiptap.fillContent({ content: 'test-content 1', index: 0 });

    // TODO: Waits are for headless mode, where text format bar is not visible sometimes
    const showFormatBar = async () => {
      await page.waitForTimeout(400);
      await openedPage.tiptap.selectNodes({ start: 1, end: 1 });
      await page.waitForTimeout(400);
      await openedPage.tiptap.selectNodes({ start: 0, end: 0 });
      await page.waitForTimeout(400);
    };

    // TODO: Waits are for headless mode, where text format bar is not visible sometimes
    const clickTextFormatButton = async (type: TextFormatType) => {
      await showFormatBar();
      await openedPage.tiptap.clickTextFormatButton(type);
      await showFormatBar();
      await page.waitForTimeout(1000);
    };

    // Bold
    await clickTextFormatButton('bold');

    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: 'bold',
      active: true,
    });
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      text: 'test-content 1',
      formatType: 'bold',
    });

    // Italic
    await clickTextFormatButton('italic');

    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: 'italic',
      active: true,
    });
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      text: 'test-content 1',
      formatType: 'italic',
    });

    // Underline
    await clickTextFormatButton('underline');

    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: 'underline',
      active: true,
    });
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      text: 'test-content 1',
      formatType: 'underline',
    });

    // Strike
    await clickTextFormatButton('strike');

    await openedPage.tiptap.verifyTextFormatButtonActive({
      type: 'strike',
      active: true,
    });
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      text: 'test-content 1',
      formatType: 'strike',
    });
    await page.waitForTimeout(400);

    // Link
    await openedPage.tiptap.selectNodes({ start: 1, end: 1 });
    await openedPage.tiptap.selectNodes({ start: 0, end: 0 });
    await openedPage.tiptap.clickTextFormatButton('link');

    await openedPage.tiptap.verifyLinkOptionVisible({
      visible: true,
    });
    await page.waitForTimeout(400);
    await page.keyboard.type('https://www.google.com');
    await page.keyboard.press('Enter');
    await openedPage.tiptap.verifyLinkNode({
      index: 0,
      url: 'https://www.google.com',
      placeholder: 'test-content 1',
    });
  });
});
