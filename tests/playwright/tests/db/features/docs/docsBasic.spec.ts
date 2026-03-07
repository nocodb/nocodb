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

  test('Create a page from the sidebar', async ({ page }) => {
    // A new docs base should show an empty page list with an "Add page" button
    await dashboard.sidebar.docsSidebar.verifyCreatePageButtonVisibility({
      baseTitle: context.base.title,
      isVisible: true,
    });

    // Create a page via the sidebar button
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: context.base.title,
      title: 'My First Page',
    });

    // Verify page appears in sidebar
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      baseTitle: context.base.title,
      title: 'My First Page',
    });

    // Verify the editor opened and shows the correct title
    await dashboard.docs.openedPage.verifyTitle({ title: 'My First Page' });
  });

  test('Rename a page via the title input', async ({ page }) => {
    // Create a page first
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: context.base.title,
      title: 'Original Title',
    });

    // Rename by editing the title input in the editor
    await dashboard.docs.openedPage.fillTitle({ title: 'Renamed Page' });

    // Wait for debounced sync to sidebar
    await page.waitForTimeout(1500);

    // Verify the sidebar updates with the new title
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      baseTitle: context.base.title,
      title: 'Renamed Page',
    });
  });

  test('Delete a page via the context menu', async ({ page }) => {
    // Create a page
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: context.base.title,
      title: 'Page To Delete',
    });

    // Verify it exists
    await dashboard.sidebar.docsSidebar.verifyPageInSidebar({
      baseTitle: context.base.title,
      title: 'Page To Delete',
    });

    // Delete the page
    await dashboard.sidebar.docsSidebar.deletePage({
      baseTitle: context.base.title,
      title: 'Page To Delete',
    });

    // Verify it's removed from sidebar
    await dashboard.sidebar.docsSidebar.verifyPageIsNotInSidebar({
      baseTitle: context.base.title,
      title: 'Page To Delete',
    });
  });

  test('Set a page icon via the editor icon picker', async ({ page }) => {
    // Create a page
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: context.base.title,
      title: 'Icon Test Page',
    });

    // Select an emoji via the editor's icon picker
    await dashboard.docs.openedPage.selectEmoji({ emoji: 'bulb' });

    // Wait for the update to propagate
    await page.waitForTimeout(500);
  });
});
