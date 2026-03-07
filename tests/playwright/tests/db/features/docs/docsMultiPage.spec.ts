import { expect, test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import axios from 'axios';

/**
 * Create a page via the internal API (same endpoint the UI uses).
 */
async function createPageViaApi({
  token,
  workspaceId,
  baseId,
  title,
}: {
  token: string;
  workspaceId: string;
  baseId: string;
  title: string;
}) {
  const response = await axios.post(
    `http://localhost:8080/api/v1/internal/${workspaceId}/${baseId}`,
    {
      operation: 'docCreate',
      title,
    },
    {
      headers: { 'xc-auth': token },
    }
  );
  return response.data;
}

test.describe('Docs — Multi-page', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({
      page,
      baseType: ProjectTypes.DOCUMENTATION,
      isEmptyProject: true,
    });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create multiple pages and verify all appear in sidebar', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first page via UI
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle,
      title: 'Page Alpha',
    });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Page Alpha' });

    // Create additional pages via API
    await createPageViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Page Beta',
    });

    await createPageViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Page Gamma',
    });

    // Reload to pick up API-created pages
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify all three pages appear in the sidebar
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Page Alpha' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Page Beta' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Page Gamma' });
  });

  test('Switch between pages and verify editor content changes', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first page with content via UI
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle,
      title: 'Page One',
    });
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'Content for page one' });
    await page.waitForTimeout(500);

    // Create second page via API
    await createPageViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Page Two',
    });

    // Reload to pick up API-created page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Open second page
    await dashboard.sidebar.docsSidebar.openPage({ baseTitle, title: 'Page Two' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'Page Two' });

    // Switch back to first page
    await dashboard.sidebar.docsSidebar.openPage({ baseTitle, title: 'Page One' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'Page One' });

    // Verify content persisted
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'Content for page one' });
  });

  test('Delete one page from multiple and verify others remain', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first page via UI
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle,
      title: 'Keep This Page',
    });

    // Create second page via API
    await createPageViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Delete This Page',
    });

    // Reload to pick up API-created page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify both exist
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Keep This Page' });
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Delete This Page' });

    // Delete second page
    await dashboard.sidebar.docsSidebar.deletePage({ baseTitle, title: 'Delete This Page' });

    // Verify first page still exists, second is gone
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({ baseTitle, title: 'Keep This Page' });
    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({ baseTitle, title: 'Delete This Page' });
  });
});
