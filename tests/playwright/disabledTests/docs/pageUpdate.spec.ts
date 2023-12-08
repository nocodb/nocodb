import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Create docs base and verify docs UI', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Update title page of root and child page and verify', async ({ page }) => {
    const openedPage = dashboard.docs.openedPage;
    // Page update of root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-page' });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page',
      baseTitle: base.title as any,
    });

    await page.reload();

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page',
      baseTitle: base.title as any,
    });

    await openedPage.verifyTitle({ title: 'root-page' });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page' }] });

    // Page update of child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page',
      baseTitle: base.title as any,
      title: 'child-page',
    });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page',
      baseTitle: base.title as any,
      level: 1,
    });

    await page.reload();

    await page.waitForTimeout(1500);

    await openedPage.verifyTitle({ title: 'child-page' });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page' }, { title: 'child-page' }] });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page',
      baseTitle: base.title as any,
      level: 1,
    });

    // Verify that page title doesnt break when a new page is created, an existing page is opened and title is changed and new page is opened again and the title is updated there as well
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page',
      baseTitle: base.title as any,
    });

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'child-page',
      baseTitle: base.title as any,
    });
    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-1' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-1',
      baseTitle: base.title as any,
      level: 1,
    });
    await openedPage.verifyTitle({ title: 'child-page-1' });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page' }, { title: 'child-page-1' }] });

    await dashboard.sidebar.docsSidebar.openPage({ title: 'Page', baseTitle: base.title as any });
    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-2' });
    await openedPage.verifyTitle({ title: 'child-page-2' });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page' }, { title: 'child-page-2' }] });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-2',
      baseTitle: base.title as any,
      level: 1,
    });
  });

  test('Update emoji and content of newly created root page and child page', async ({ page }) => {
    const openedPage = dashboard.docs.openedPage;
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-page' });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.sidebar.docsSidebar.selectEmoji({
      emoji: 'hot-dog',
      baseTitle: base.title as any,
      title: 'root-page',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'hot-dog',
      baseTitle: base.title as any,
      title: 'root-page',
    });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'hot-dog' });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page', emoji: 'hot-dog' }] });

    await dashboard.docs.openedPage.selectEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'rolling-on-the-floor-laughing',
      baseTitle: base.title as any,
      title: 'root-page',
    });
    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page', emoji: 'rolling-on-the-floor-laughing' }] });

    await dashboard.docs.openedPage.fillTitle({ title: 'root-page-1' });
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'root-page-1-content' });
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'root-page-1-content' });

    await openedPage.verifyBreadcrumb({ pages: [{ title: 'root-page-1', emoji: 'rolling-on-the-floor-laughing' }] });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'root-page-1',
      baseTitle: base.title as any,
    });

    // child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-page-1',
      baseTitle: base.title as any,
      title: 'child-page',
    });

    await dashboard.docs.openedPage.fillTitle({ title: 'child-page-1' });
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'child-page-1-content' });
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'child-page-1-content' });
    await openedPage.verifyBreadcrumb({
      pages: [{ title: 'root-page-1', emoji: 'rolling-on-the-floor-laughing' }, { title: 'child-page-1' }],
    });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      emoji: 'hot-dog',
      baseTitle: base.title as any,
      title: 'child-page-1',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'hot-dog',
      baseTitle: base.title as any,
      title: 'child-page-1',
    });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'hot-dog' });
    await openedPage.verifyBreadcrumb({
      pages: [
        { title: 'root-page-1', emoji: 'rolling-on-the-floor-laughing' },
        { title: 'child-page-1', emoji: 'hot-dog' },
      ],
    });

    await dashboard.docs.openedPage.selectEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitleEmoji({ emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      emoji: 'rolling-on-the-floor-laughing',
      baseTitle: base.title as any,
      title: 'child-page-1',
    });
    await openedPage.verifyBreadcrumb({
      pages: [
        { title: 'root-page-1', emoji: 'rolling-on-the-floor-laughing' },
        { title: 'child-page-1', emoji: 'rolling-on-the-floor-laughing' },
      ],
    });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-1',
      baseTitle: base.title as any,
      level: 1,
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'root-page-1',
    });
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'root-page-1-content' });
    await dashboard.docs.openedPage.tiptap.clearContent();
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'new-root-page-1-content' });
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'new-root-page-1-content' });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'child-page-1',
    });
    // TODO: Child page content is not updated in this case, only on playwright
    // await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'child-page-1-content' });
    await dashboard.docs.openedPage.tiptap.clearContent();
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'new-child-page-1-content' });
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'new-child-page-1-content' });

    await page.reload();

    await openedPage.waitForRender();
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'new-child-page-1-content' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-page-1',
      baseTitle: base.title as any,
      level: 1,
      emoji: 'rolling-on-the-floor-laughing',
    });
    await openedPage.verifyBreadcrumb({
      pages: [
        { title: 'root-page-1', emoji: 'rolling-on-the-floor-laughing' },
        { title: 'child-page-1', emoji: 'rolling-on-the-floor-laughing' },
      ],
    });
    await openedPage.verifyTitle({ title: 'child-page-1' });
    await openedPage.verifyTitleEmoji({ emoji: 'rolling-on-the-floor-laughing' });
  });
});
