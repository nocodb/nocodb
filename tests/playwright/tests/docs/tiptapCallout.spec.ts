import { Page, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Callout', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Info Callout', async ({ page }) => {
    await testCallout('Info notice', page);
  });

  async function testCallout(type: 'Info notice' | 'Warning notice' | 'Tip notice', page: Page) {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type,
    });

    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace');
  }
});
