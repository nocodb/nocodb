import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs Page reorder test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Reorder #1', async () => {
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-1' });
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-2-shared' });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'root-1',
    });
    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });
    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'root-2-shared',
    });
    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });

    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: 'root-2-shared',
      newParentTitle: 'root-1',
    });

    await dashboard.sidebar.docsSidebar.verifyParent({
      baseTitle: base.title as any,
      title: 'root-2-shared',
      parentTitle: 'root-1',
      parentLevel: 0,
    });

    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });
  });

  test('Reorder #2', async () => {
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-1' });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-2' });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-3-shared' });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-4-private' });

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-1',
      baseTitle: base.title as any,
      title: '1-child',
    });
    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-1' });
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-2',
      baseTitle: base.title as any,
      title: '2-child',
    });
    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-2' });
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: '2-child',
      baseTitle: base.title as any,
      title: '2-child-child',
    });
    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-2' });
    await dashboard.shareProjectButton.close();

    // Reorder
    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '1-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '1-child',
      newParentTitle: 'root-3-shared',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-3-shared' });
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '2-child-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child-child',
      newParentTitle: 'root-3-shared',
    });
    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-3-shared' });
    await dashboard.shareProjectButton.close();

    // Reorder
    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '1-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '1-child',
      newParentTitle: '2-child',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-2' });
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '2-child-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child-child',
      newParentTitle: '2-child',
    });
    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.verifyPageSharedParentShare({ parentTitle: 'root-2' });
    await dashboard.shareProjectButton.close();

    // Reorder
    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '1-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '1-child',
      newParentTitle: 'root-4-private',
    });

    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '2-child-child',
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child-child',
      newParentTitle: 'root-4-private',
    });
    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });
  });

  test('Reorder #3', async () => {
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-1' });
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any, title: 'root-2' });

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-2',
      baseTitle: base.title as any,
      title: '2-child',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child',
      newParentTitle: 'root-1',
      dragToTop: true,
    });

    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'public' });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'root-1',
    });
    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'root-1',
      baseTitle: base.title as any,
      title: '1-child',
    });

    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'public' });

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      baseTitle: base.title as any,
      title: '1-child',
      level: 1,
    });
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '1-child',
      newParentTitle: '2-child',
      dragToTop: true,
    });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      baseTitle: base.title as any,
      title: '1-child',
      level: 0,
    });

    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });

    // Reorder root page to another root page
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: 'root-2',
      newParentTitle: '1-child',
    });

    await dashboard.sidebar.docsSidebar.verifyParent({
      baseTitle: base.title as any,
      title: 'root-2',
      parentLevel: 0,
      parentTitle: '1-child',
    });

    // Reorder root page to a child page

    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: 'root-1',
      newParentTitle: 'root-2',
    });

    await dashboard.sidebar.docsSidebar.verifyParent({
      baseTitle: base.title as any,
      title: 'root-1',
      parentLevel: 1,
      parentTitle: 'root-2',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '2-child',
    });
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: '2-child',
      baseTitle: base.title as any,
      title: '2-child-child',
    });

    // Reorder child page to a root page
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child-child',
      newParentTitle: '1-child',
    });

    await dashboard.sidebar.docsSidebar.verifyParent({
      baseTitle: base.title as any,
      title: '2-child-child',
      parentLevel: 0,
      parentTitle: '1-child',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: '2-child',
    });
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: '2-child',
      baseTitle: base.title as any,
      title: '2-child-child-2',
    });

    // Reorder child page to a child page
    await dashboard.sidebar.docsSidebar.reorderPage({
      baseTitle: base.title as any,
      title: '2-child-child-2',
      newParentTitle: 'root-2',
    });
    await dashboard.sidebar.docsSidebar.verifyParent({
      baseTitle: base.title as any,
      title: '2-child-child-2',
      parentLevel: 1,
      parentTitle: 'root-2',
    });
  });
});
