import { expect, test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';

test.describe('Docs — Basic CRUD', () => {
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

  test('Create a document from the sidebar', async ({ page }) => {
    // A new docs base should show an empty document list with an "Add document" button
    await dashboard.sidebar.docsSidebar.verifyCreateDocumentButtonVisibility({
      baseTitle: context.base.title,
      isVisible: true,
    });

    // Create a document via the sidebar button
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'My First Document',
    });

    // Verify document appears in sidebar
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({
      baseTitle: context.base.title,
      title: 'My First Document',
    });

    // Verify the editor opened and shows the correct title
    await dashboard.docs.openedPage.verifyTitle({ title: 'My First Document' });
  });

  test('Rename a document via the title input', async ({ page }) => {
    // Create a document first
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'Original Title',
    });

    // Rename by editing the title input in the editor
    await dashboard.docs.openedPage.fillTitle({ title: 'Renamed Document' });

    // Wait for debounced sync to sidebar
    await page.waitForTimeout(1500);

    // Verify the sidebar updates with the new title
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({
      baseTitle: context.base.title,
      title: 'Renamed Document',
    });
  });

  test('Delete a document via the context menu', async ({ page }) => {
    // Create a document
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'Document To Delete',
    });

    // Verify it exists
    await dashboard.sidebar.docsSidebar.verifyDocumentInSidebar({
      baseTitle: context.base.title,
      title: 'Document To Delete',
    });

    // Delete the document
    await dashboard.sidebar.docsSidebar.deleteDocument({
      baseTitle: context.base.title,
      title: 'Document To Delete',
    });

    // Verify it's removed from sidebar
    await dashboard.sidebar.docsSidebar.verifyDocumentIsNotInSidebar({
      baseTitle: context.base.title,
      title: 'Document To Delete',
    });
  });

  test('Set a document icon via the editor icon picker', async ({ page }) => {
    // Create a document
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'Icon Test Document',
    });

    // Select an emoji via the editor's icon picker
    await dashboard.docs.openedPage.selectEmoji({ emoji: 'bulb' });

    // Wait for the update to propagate
    await page.waitForTimeout(500);
  });
});
