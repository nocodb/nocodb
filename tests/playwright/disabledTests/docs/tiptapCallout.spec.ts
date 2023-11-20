import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Callout', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Info Callout', async ({ page }) => {
    await testCallout('Info notice', page);
  });

  test('Warning Callout', async ({ page }) => {
    await testCallout('Warning notice', page);
  });

  test('Tip Callout', async ({ page }) => {
    await testCallout('Tip notice', page);
  });

  async function testCallout(type: 'Info notice' | 'Warning notice' | 'Tip notice', page: Page) {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type,
    });

    await page.keyboard.press('Backspace');

    await openedPage.tiptap.addNewNode({
      type,
      index: 1,
    });

    await page.keyboard.type('Callout content');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      content: 'Callout content',
    });

    await page.keyboard.press('Enter');
    await page.keyboard.type('Callout content 2');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      content: 'Callout contentCallout content 2',
      childParagraphCount: 2,
    });

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('new');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      childParagraphCount: 3,
      childParagraph: {
        index: 2,
        content: '2new',
      },
    });

    // Clear 3 child
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.press('Backspace');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      childParagraphCount: 2,
    });

    await page.keyboard.press('Enter');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      childParagraphCount: 3,
    });

    await page.keyboard.press('Enter');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type,
      childParagraphCount: 2,
    });

    await openedPage.tiptap.addNewNode({
      type,
    });

    await openedPage.tiptap.verifyNode({
      index: 2,
      type,
    });

    await page.keyboard.press('Enter');

    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Paragraph',
    });
  }
});
