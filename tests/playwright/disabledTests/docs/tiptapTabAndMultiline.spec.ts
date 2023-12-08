import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Tab and multi line test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:Tab and multi line test', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.fillContent({ content: 'page content', index: 0 });
    await openedPage.tiptap.fillContent({ content: 'page content 2', index: 1 });
    await openedPage.tiptap.fillContent({ content: 'page content 3', index: 2 });

    await openedPage.tiptap.clickNode({ index: 0, start: true });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'page1 content',
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'page1 1content',
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'page1 1content1',
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');

    await openedPage.tiptap.verifyNode({
      index: 1,
      content: '1page content 2',
    });

    // Verify tab with multi line
    await openedPage.tiptap.clickNode({ index: 1, start: false });
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('2');

    await openedPage.tiptap.verifyNode({
      index: 1,
      content: '1page content 22',
    });

    await openedPage.tiptap.clickNode({ index: 1, start: false });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('2');

    await openedPage.tiptap.verifyNode({
      index: 2,
      content: '2page content 3',
    });
  });
});
