import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Keyboard shortcuts and drag and drop', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:Drag and drop', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 1',
      index: 0,
    });
    await openedPage.tiptap.fillContent({
      content: 'Heading 1 content',
      index: 0,
      type: 'Heading 1',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 2',
      index: 1,
    });
    await openedPage.tiptap.fillContent({
      content: 'Heading 2 content',
      index: 1,
      type: 'Heading 2',
    });

    await openedPage.tiptap.dragToNode({
      fromIndex: 0,
      toIndex: 1,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 2',
      content: 'Heading 2 content',
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Heading 1',
      content: 'Heading 1 content',
    });

    await openedPage.tiptap.addNewNode({
      index: 2,
      type: 'Image',
      filePath: `${__dirname}/../../fixtures/sampleFiles/sampleImage.jpeg`,
    });
    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Image',
      isUploading: false,
    });

    await openedPage.tiptap.clickNode({
      index: 2,
      start: false,
    });
    await openedPage.tiptap.dragToNode({
      fromIndex: 2,
      toIndex: 0,
      withoutHandle: true,
    });
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 2',
      content: 'Heading 2 content',
    });
    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Image',
      isUploading: false,
    });
    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Heading 1',
      content: 'Heading 1 content',
    });
  });

  test('Tiptap:Keyboard shortcuts', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.clickNode({
      index: 0,
      start: true,
    });
    await page.keyboard.press('Control+Shift+1');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 1',
    });

    await page.waitForTimeout(300);

    await openedPage.tiptap.clickNode({
      index: 0,
      start: true,
    });
    await page.keyboard.press('Control+Shift+2');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 2',
    });

    await page.waitForTimeout(300);

    await openedPage.tiptap.clickNode({
      index: 0,
      start: true,
    });
    await page.keyboard.press('Control+Shift+3');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 3',
    });

    await page.waitForTimeout(300);
    await openedPage.tiptap.clearContent();

    await openedPage.tiptap.fillContent({
      content: 'Link content',
      index: 0,
    });
    await page.waitForTimeout(300);
    await openedPage.tiptap.selectNodes({
      start: 0,
      end: 0,
    });
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+K');
    await openedPage.tiptap.verifyLinkOptionVisible({
      visible: true,
    });
    await openedPage.tiptap.verifyLinkNode({
      index: 0,
      placeholder: 'Link content',
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await openedPage.tiptap.clearContent();
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      content: 'Quote content',
      index: 0,
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+]');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Quote',
      content: 'Quote content',
    });

    await openedPage.tiptap.clearContent();
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      content: 'Code content',
      index: 0,
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Alt+Meta+C');
    await openedPage.tiptap.verifyTextFormatting({
      index: 0,
      formatType: 'code',
      text: 'Code content',
    });

    await openedPage.tiptap.clearContent();

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'Bullet content',
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Alt+2');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Bullet List',
      content: 'Bullet content',
    });

    await openedPage.tiptap.clearContent();
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'Numbered content',
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Alt+3');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Numbered List',
      content: 'Numbered content',
    });

    await openedPage.tiptap.clearContent();
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'Todo content',
    });

    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Alt+1');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Task List',
      content: 'Todo content',
    });

    await openedPage.tiptap.clearContent();
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+Shift+H');
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Divider',
    });
  });

  test('Tiptap:Keyboard shortcuts selection', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    // Cmd + Left
    await openedPage.tiptap.fillContent({
      content: 'Content 1',
    });
    await openedPage.tiptap.verifyNode({
      content: 'Content 1',
      index: 0,
    });

    await page.keyboard.press('Meta+ArrowLeft');

    // Cmd + Shift + Right
    await page.waitForTimeout(300);
    await page.keyboard.press('Shift+Meta+ArrowRight');
    await page.waitForTimeout(300);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'New Content 1',
    });
    await openedPage.tiptap.verifyNode({
      content: 'New Content 1',
      index: 0,
    });

    await page.keyboard.press('Meta+ArrowLeft');
    await page.waitForTimeout(300);

    // Cmd + Right
    await page.keyboard.press('Meta+ArrowRight');
    await page.waitForTimeout(300);

    // Cmd + Shift + Left
    await page.keyboard.press('Shift+Meta+ArrowLeft');
    await page.waitForTimeout(300);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'New New Content 1',
    });
    await openedPage.tiptap.verifyNode({
      content: 'New New Content 1',
      index: 0,
    });

    // Cmd + Backspace
    await page.keyboard.press('Meta+Backspace');
    await page.waitForTimeout(300);

    await openedPage.tiptap.fillContent({
      index: 0,
      content: 'New New New Content 1',
    });
    await openedPage.tiptap.verifyNode({
      content: 'New New New Content 1',
      index: 0,
    });
  });
});
