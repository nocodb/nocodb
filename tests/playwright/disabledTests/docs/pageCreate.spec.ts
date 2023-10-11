import { expect, test } from '@playwright/test';
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

  test('Create root and child page and verify UI', async ({ page }) => {
    // root page
    await dashboard.sidebar.docsSidebar.createPage({ baseTitle: base.title as any });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('test-page');
    await page.waitForTimeout(500);

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'test-page',
      baseTitle: base.title as any,
    });

    // child page
    await dashboard.sidebar.docsSidebar.createChildPage({
      parentTitle: 'test-page',
      baseTitle: base.title as any,
    });

    await page.waitForTimeout(500);
    await page.keyboard.insertText('child-test-page');
    await page.waitForTimeout(500);
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child-test-page',
      baseTitle: base.title as any,
      level: 1,
    });

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'test-page',
      baseTitle: base.title as any,
    });
    await dashboard.docs.openedPage.verifyOpenedPageVisible();
    await dashboard.docs.openedPage.verifyChildPage({
      title: 'child-test-page',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      title: 'child-test-page',
      baseTitle: base.title as any,
    });
    await dashboard.docs.openedPage.verifyChildPagesNotVisible();
  });

  test('Shortcuts for page creation and verify sidebar on reload', async ({ page }) => {
    // root page
    await page.keyboard.press('Alt+N');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('parent');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'parent',
      baseTitle: base.title as any,
      level: 0,
    });

    expect(
      await dashboard.sidebar.docsSidebar.getTitleOfOpenedPage({
        baseTitle: base.title as any,
      })
    ).toBe('parent');

    await page.keyboard.press('Alt+M');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('child');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'child',
      baseTitle: base.title as any,
      level: 1,
    });

    expect(
      await dashboard.sidebar.docsSidebar.getTitleOfOpenedPage({
        baseTitle: base.title as any,
      })
    ).toBe('child');

    await page.keyboard.press('Alt+H');
    await dashboard.docs.openedPage.waitForRender();

    await page.waitForTimeout(500);
    await page.keyboard.insertText('Parent 1');

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'Parent 1',
      baseTitle: base.title as any,
      level: 0,
    });

    expect(
      await dashboard.sidebar.docsSidebar.getTitleOfOpenedPage({
        baseTitle: base.title as any,
      })
    ).toBe('Parent 1');

    // reload

    await dashboard.docs.openedPage.fillTitle({ title: 'New Parent 1' });

    await page.reload();
    await dashboard.docs.openedPage.waitForRender();

    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      title: 'New Parent 1',
      baseTitle: base.title as any,
      level: 0,
    });
  });
});
