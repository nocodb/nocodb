import { test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:External link test and headers', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Tiptap:External link test', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await page.waitForTimeout(400);

    const embedUrl = 'https://docs.google.com/document/d/1PEAuWDF-w2q5QEPGRiAJ_CSSrz0G6eM8AD0hkTmErt0/preview';

    await openedPage.tiptap.addNewNode({
      type: 'Embed iframe',
      link: embedUrl,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Embed iframe',
      content: embedUrl,
    });

    await page.keyboard.press('Meta+z');

    await openedPage.tiptap.addNewNode({
      type: 'Embed iframe',
      link: 'invalid',
      noVerify: true,
    });
    await openedPage.tiptap.verifyErrorCommandMenu({ error: 'Given link is not valid' });
    await openedPage.tiptap.clickBackButtonLinkCommandMenu();
    await page.waitForTimeout(400);
    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });
    await page.keyboard.press('Escape');

    await openedPage.tiptap.verifyCommandMenuOpened({
      isVisible: false,
    });

    await page.waitForTimeout(400);

    await openedPage.copyToClipboard({
      text: embedUrl,
    });

    // TODO: Does not work in headless mode
    // await page.keyboard.press('Meta+v');

    // await openedPage.tiptap.verifyNode({
    //   index: 0,
    //   type: 'Embed iframe',
    //   content: embedUrl,
    // });
  });

  test('Tiptap:Header test', async () => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 1',
    });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 1',
    });

    await openedPage.tiptap.fillContent({ content: 'Header 1', index: 0, type: 'Heading 1' });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 1',
      content: 'Header 1',
    });

    await openedPage.tiptap.clearContent();

    await openedPage.tiptap.addNewNode({
      type: 'Heading 2',
    });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 2',
    });

    await openedPage.tiptap.fillContent({ content: 'Header 2', index: 0, type: 'Heading 2' });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 2',
      content: 'Header 2',
    });

    await openedPage.tiptap.clearContent();

    await openedPage.tiptap.addNewNode({
      type: 'Heading 3',
    });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 3',
    });

    await openedPage.tiptap.fillContent({ content: 'Header 3', index: 0, type: 'Heading 3' });

    await openedPage.tiptap.verifyHeaderNode({
      index: 0,
      type: 'Heading 3',
      content: 'Header 3',
    });
  });
});
