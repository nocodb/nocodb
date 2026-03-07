import { expect, test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import axios from 'axios';

/**
 * Create a document via the internal API (same endpoint the UI uses).
 */
async function createDocumentViaApi({
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
      operation: 'documentCreate',
      title,
    },
    {
      headers: { 'xc-auth': token },
    }
  );
  return response.data;
}

test.describe('Docs — Multi-document', () => {
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

  test('Create multiple documents and verify all appear in sidebar', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first document via UI
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Document Alpha',
    });
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Document Alpha' });

    // Create additional documents via API
    await createDocumentViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Document Beta',
    });

    await createDocumentViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Document Gamma',
    });

    // Reload to pick up API-created documents
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify all three documents appear in the sidebar
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Document Alpha' });
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Document Beta' });
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Document Gamma' });
  });

  test('Switch between documents and verify editor content changes', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first document with content via UI
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Document One',
    });
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'Content for document one' });
    await page.waitForTimeout(500);

    // Create second document via API
    await createDocumentViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Document Two',
    });

    // Reload to pick up API-created document
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Open second document
    await dashboard.sidebar.docsSidebar.openDocument({ baseTitle, title: 'Document Two' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'Document Two' });

    // Switch back to first document
    await dashboard.sidebar.docsSidebar.openDocument({ baseTitle, title: 'Document One' });
    await dashboard.docs.openedPage.verifyTitle({ title: 'Document One' });

    // Verify content persisted
    await dashboard.docs.openedPage.tiptap.verifyContent({ content: 'Content for document one' });
  });

  test('Delete one document from multiple and verify others remain', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create first document via UI
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Keep This Document',
    });

    // Create second document via API
    await createDocumentViaApi({
      token: context.token,
      workspaceId: context.workspace.id,
      baseId: context.base.id,
      title: 'Delete This Document',
    });

    // Reload to pick up API-created document
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify both exist
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Keep This Document' });
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Delete This Document' });

    // Delete second document
    await dashboard.sidebar.docsSidebar.deleteDocument({ baseTitle, title: 'Delete This Document' });

    // Verify first document still exists, second is gone
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Keep This Document' });
    await dashboard.sidebar.docsSidebar.verifyDocumentIsNotInSidebar({ baseTitle, title: 'Delete This Document' });
  });
});
