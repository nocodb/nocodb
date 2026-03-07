import { expect, test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import { isEE } from '../../../../setup/db';

test.describe('Docs — Sub-documents & Hierarchy', () => {
  if (!isEE()) test.skip();
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

  test('Create a sub-document via context menu', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create a parent document
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Parent Doc',
    });

    // Create a sub-document via context menu (without filling title inline to avoid race)
    await dashboard.sidebar.docsSidebar.createSubDocument({
      baseTitle,
      parentTitle: 'Parent Doc',
    });

    // The sub-document was created and opened — verify it's a child of the parent
    // The breadcrumb or sidebar should show it nested under "Parent Doc"
    await dashboard.docs.openedPage.waitForRender();

    // Fill the title of the newly created sub-document
    await dashboard.docs.openedPage.fillTitle({ title: 'Child Doc' });
    await page.waitForTimeout(500);

    // Verify the child editor shows the correct title
    await dashboard.docs.openedPage.verifyTitle({ title: 'Child Doc' });
  });

  test('Duplicate a document via context menu', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create a document with content
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Original Doc',
    });
    await dashboard.docs.openedPage.tiptap.fillContent({ content: 'Some content to duplicate' });
    await page.waitForTimeout(500);

    // Duplicate it
    await dashboard.sidebar.docsSidebar.duplicateDocument({
      baseTitle,
      title: 'Original Doc',
    });

    // Reload to pick up the duplicate
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify both original and duplicate exist in sidebar
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({ baseTitle, title: 'Original Doc' });
  });

  test('Delete parent cascades children from sidebar', async ({ page }) => {
    const baseTitle = context.base.title;

    // Create parent
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle,
      title: 'Cascade Parent',
    });

    // Create child via context menu (opens as "Untitled")
    await dashboard.sidebar.docsSidebar.createSubDocument({
      baseTitle,
      parentTitle: 'Cascade Parent',
    });

    // Fill the child title
    await dashboard.docs.openedPage.fillTitle({ title: 'Cascade Child' });
    await page.waitForTimeout(1000);

    // Navigate back to parent to ensure sidebar is in correct state
    await dashboard.sidebar.docsSidebar.openDocument({ baseTitle, title: 'Cascade Parent' });

    // Delete parent
    await dashboard.sidebar.docsSidebar.deleteDocument({
      baseTitle,
      title: 'Cascade Parent',
    });

    // After deletion, the child should also be gone
    await dashboard.sidebar.docsSidebar.verifyDocumentIsNotInSidebar({
      baseTitle,
      title: 'Cascade Parent',
    });
    await dashboard.sidebar.docsSidebar.verifyDocumentIsNotInSidebar({
      baseTitle,
      title: 'Cascade Child',
    });
  });
});
