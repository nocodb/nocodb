import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs page list', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Docs page list', async ({ page }) => {
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'page',
      baseTitle: base.title as any,
      title: 'child-page',
    });

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page-2',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.openProject({
      title: base.title as any,
    });

    await page.waitForTimeout(1000);

    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page-2',
      tab: 'all',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page',
      tab: 'all',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'child-page',
      tab: 'all',
    });

    await dashboard.docs.pagesList.openTab({
      tab: 'allByTitle',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'child-page',
      index: 0,
      tab: 'allByTitle',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page',
      index: 1,
      tab: 'allByTitle',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page-2',
      index: 2,
      tab: 'allByTitle',
    });

    await dashboard.docs.pagesList.openTab({
      tab: 'shared',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page-2',
      tab: 'shared',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'page',
      baseTitle: base.title as any,
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'page-2',
      baseTitle: base.title as any,
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.openProject({
      title: base.title as any,
    });

    await dashboard.docs.pagesList.openTab({
      tab: 'shared',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'page',
      tab: 'shared',
    });
    await dashboard.docs.pagesList.verifyPageInList({
      title: 'child-page',
      tab: 'shared',
    });
  });
});
