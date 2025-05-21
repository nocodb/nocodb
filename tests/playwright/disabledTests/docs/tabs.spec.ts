import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs Tabs test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tab open and close for pages/book', async ({ page }) => {
    await dashboard.verifyOpenedTab({ title: base.title as any });

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'nested-root-single-page',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });

    await dashboard.sidebar.docsSidebar.createChildPage({
      baseTitle: base.title as any,
      parentTitle: 'nested-root-single-page',
      title: 'nested-child-single-page',
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();
    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page' });

    await dashboard.docs.openedPage.fillTitle({ title: 'new-nested-child-single-page' });
    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'cool-button',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'cool-button',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page', emoji: 'cool-button' });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-child-single-page', emoji: 'rolling-on-the-floor-laughing' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'new-nested-child-single-page' });

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'nested-root-single-page' });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'nested-root-single-page',
    });

    await dashboard.sidebar.docsSidebar.selectEmoji({
      baseTitle: base.title as any,
      title: 'nested-root-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });
    await dashboard.sidebar.docsSidebar.verifyEmoji({
      baseTitle: base.title as any,
      title: 'nested-root-single-page',
      emoji: 'rolling-on-the-floor-laughing',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page', emoji: 'rolling-on-the-floor-laughing' });

    await dashboard.verifyOpenedTab({ title: base.title as any });
    await dashboard.docs.pagesList.verifyProjectTitle({ title: base.title as any });

    // Delete verification

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
    });
    await dashboard.verifyOpenedTab({ title: 'new-nested-child-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'new-nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.deletePage({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
    });

    await dashboard.verifyOpenedTab({ title: base.title as any });
    await dashboard.verifyTabIsNotOpened({ title: 'new-nested-child-single-page' });

    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
    });

    // Reload verification
    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'nested-root-single-page',
    });

    // verify deleted page is not in sidebar
    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({
      baseTitle: base.title as any,
      title: 'new-nested-child-single-page',
    });

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'nested-root-single-page' });

    await page.reload();

    await dashboard.verifyOpenedTab({ title: 'nested-root-single-page' });

    await dashboard.sidebar.openProject({ title: base.title as any });
    await page.reload();

    await dashboard.verifyOpenedTab({ title: base.title });
  });
});
