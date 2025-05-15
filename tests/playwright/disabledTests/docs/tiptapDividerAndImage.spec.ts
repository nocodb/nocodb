import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Divider and Image', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:Divider', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.fillContent({
      content: 'page content',
      index: 0,
    });

    await openedPage.tiptap.addNewNode({
      type: 'Divider',
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Divider',
    });

    await page.waitForTimeout(550);

    // Verify that styling is correct when selected

    await openedPage.tiptap.clickNode({
      index: 1,
      start: false,
    });
    await openedPage.tiptap.verifyNodeSelected({
      index: 1,
    });

    // Pressing enter when selected should create a new line below it
    await page.keyboard.press('Enter');
    await page.keyboard.type('P');

    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Paragraph',
      content: 'P',
    });

    // Pressing backspace on an empty line with a divider on top should select that divider
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await openedPage.tiptap.verifyNodeSelected({
      index: 1,
    });

    // Pressing backspace when selected should delete it
    await page.keyboard.press('Backspace');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
    });
  });

  test('Tiptap:Image', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1000 * 1024 * 1024) / 8,
      uploadThroughput: (30 * 1024 * 1024) / 8,
      latency: 70,
    });

    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Image',
      filePath: `${__dirname}/../../fixtures/sampleFiles/sampleImage.jpeg`,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Image',
      isUploading: true,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Image',
      isUploading: false,
    });

    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });

    await openedPage.tiptap.verifyNodeSelected({
      index: 0,
    });

    // Pressing enter when selected should create a new line below it
    await page.keyboard.press('Enter');
    await page.keyboard.type('P');

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'P',
    });

    // Pressing backspace on an empty line with a image on top should select that image
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await openedPage.tiptap.verifyNodeSelected({
      index: 0,
    });

    // Pressing backspace when selected should delete it
    await page.keyboard.press('Backspace');

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Paragraph',
    });

    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });

    await openedPage.dropFile({
      domSelector: '.ProseMirror-focused .draggable-block-wrapper:first-child p:first-child',
      imageFilePath: `${__dirname}/fixtures/sampleFiles/sampleImage.jpeg`,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Image',
      isUploading: true,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Image',
      isUploading: false,
    });
  });
});
