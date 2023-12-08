import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Code and quote', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:Code and quote #1', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.clearContent();
    await openedPage.tiptap.addNewNode({
      type: 'Code',
      index: 0,
    });

    await openedPage.tiptap.fillContent({
      content: 'code content',
      index: 0,
      type: 'Code',
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Code',
      content: 'code content',
    });

    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.type('code content 2');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);

    await page.keyboard.type('non code content');

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Code',
      content: `code content
      code content 2`,
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'non code content',
    });

    // Quote

    await openedPage.tiptap.clearContent();
    await openedPage.tiptap.addNewNode({
      type: 'Quote',
      index: 0,
    });

    await openedPage.tiptap.fillContent({
      content: 'Quote content',
      index: 0,
      type: 'Quote',
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Quote',
      content: 'Quote content',
    });

    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.type('Quote content 2');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);

    await page.keyboard.type('non Quote content');

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Quote',
      content: `Quote contentQuote content 2`,
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'non Quote content',
    });
  });

  test('Tiptap:Code and quote (markdown and paste) #2', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.clickNode({
      index: 0,
      start: true,
    });
    await page.keyboard.type('> ');
    await page.waitForTimeout(350);
    await page.keyboard.type('Quote content');

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Quote',
      content: 'Quote content',
    });

    await openedPage.tiptap.clickNode({
      index: 1,
      start: true,
    });
    await page.keyboard.type('`');
    await page.waitForTimeout(350);
    await page.keyboard.type('code content');
    await page.waitForTimeout(350);
    await page.keyboard.type('`');

    await openedPage.tiptap.verifyTextFormatting({
      index: 1,
      formatType: 'code',
      text: 'code content',
    });

    await openedPage.tiptap.clearContent();

    await page.keyboard.type('> Quote content');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Quote',
      content: 'Quote content',
    });

    await openedPage.tiptap.clearContent();

    await page.keyboard.type('`code content`');
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      formatType: 'code',
      text: 'code content',
    });
  });
});
