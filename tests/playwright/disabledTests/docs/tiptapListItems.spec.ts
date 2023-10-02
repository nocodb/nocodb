import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs List item test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap: Bullet', async ({ page }) => {
    await verifyListItem({ type: 'Bullet List', page, startMarkdown: '- ' });
  });

  test('Tiptap: Ordered', async ({ page }) => {
    await verifyListItem({ type: 'Numbered List', page, startMarkdown: '4. ' });

    const openedPage = await dashboard.docs.openedPage;
    await openedPage.tiptap.verifyListNode({
      index: 0,
      type: 'Numbered List',
      content: 'List item 1',
      level: 0,
      nestedIndex: 0,
    });
    await openedPage.tiptap.verifyListNode({
      index: 1,
      type: 'Numbered List',
      content: 'List item 2',
      level: 1,
      nestedIndex: 1,
    });
    await openedPage.tiptap.verifyListNode({
      index: 2,
      type: 'Numbered List',
      content: 'List item ',
      level: 1,
      nestedIndex: 2,
    });
    await openedPage.tiptap.verifyListNode({
      index: 3,
      type: 'Numbered List',
      content: '',
      level: 0,
      nestedIndex: 3,
    });
  });

  test('Tiptap: Task', async ({ page }) => {
    await verifyListItem({ type: 'Task List', page, startMarkdown: '- [ ] ' });

    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'new page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Task List',
    });

    await openedPage.tiptap.fillContent({
      content: 'List item 1',
      type: 'Task List',
      index: 0,
    });

    await openedPage.tiptap.toggleTaskNode({
      index: 0,
    });

    await openedPage.tiptap.verifyListNode({
      index: 0,
      type: 'Task List',
      content: 'List item 1',
      checked: true,
      level: 0,
    });

    await openedPage.tiptap.toggleTaskNode({
      index: 0,
    });

    await openedPage.tiptap.verifyListNode({
      index: 0,
      type: 'Task List',
      content: 'List item 1',
      checked: false,
      level: 0,
    });

    await openedPage.tiptap.toggleTaskNode({
      index: 0,
    });

    await page.waitForTimeout(550);

    await openedPage.tiptap.verifyListNode({
      index: 0,
      type: 'Task List',
      content: 'List item 1',
      checked: true,
      level: 0,
    });

    await page.reload();

    await openedPage.waitForRender();
    await openedPage.tiptap.verifyListNode({
      index: 0,
      type: 'Task List',
      content: 'List item 1',
      checked: true,
      level: 0,
    });
  });

  async function verifyListItem({
    type,
    page,
    startMarkdown,
  }: {
    type: 'Bullet List' | 'Numbered List' | 'Task List';
    page: Page;
    startMarkdown: string;
  }) {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type,
    });

    await openedPage.tiptap.fillContent({
      content: 'List item 1',
      type,
      index: 0,
    });

    await openedPage.tiptap.verifyListNode({
      index: 0,
      type,
      content: 'List item 1',
      level: 0,
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await openedPage.tiptap.fillContent({
      content: 'List item 2',
      index: 1,
      type,
    });

    await openedPage.tiptap.verifyListNode({
      index: 1,
      type,
      content: 'List item 2',
      level: 0,
    });

    await page.keyboard.press('Tab');
    await openedPage.tiptap.verifyListNode({
      index: 1,
      type,
      content: 'List item 2',
      level: 1,
    });

    await page.keyboard.press('Enter');
    await openedPage.tiptap.fillContent({
      content: 'List item 3',
      index: 2,
      type,
    });

    await openedPage.tiptap.verifyListNode({
      index: 2,
      type,
      content: 'List item 3',
      level: 1,
    });

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');

    await openedPage.tiptap.verifyListNode({
      index: 2,
      type,
      content: 'List item ',
      level: 1,
    });

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '3',
      level: 1,
    });

    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyNode({
      index: 3,
      type: 'Paragraph',
    });

    await page.keyboard.type(startMarkdown);
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 1,
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyNode({
      index: 3,
      type: 'Paragraph',
    });

    await page.keyboard.type(startMarkdown);
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });

    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 1,
    });

    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyListNode({
      index: 3,
      type,
      content: '',
      level: 0,
    });
  }
});
