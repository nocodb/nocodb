import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:History and trailing node', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:History, trailing node, and first line delete', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'test-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    const openedPage = await dashboard.docs.openedPage;
    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Paragraph',
      placeholder: 'Press / to open the command menu or start writing',
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.type('Hello world');
    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'Hello world',
    });

    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Paragraph',
    });

    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });

    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Paragraph',
      content: 'Hello world',
    });

    await page.keyboard.press('Meta+z');
    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'Hello world',
    });
    await page.keyboard.press('Meta+Shift+z');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Paragraph',
      content: 'Hello world',
    });
  });
});
