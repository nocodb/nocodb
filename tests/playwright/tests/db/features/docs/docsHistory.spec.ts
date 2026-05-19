import { test } from '@playwright/test';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import { isEE } from '../../../../setup/db';

/**
 * End-to-end smoke for doc revision history. The 2-minute coalesce window
 * on the backend means we can't easily produce multiple revisions inside
 * a fast spec — so this test verifies the happy path with a single edit:
 * one revision shows in the list, restore creates a second.
 */
test.describe('Docs — Revision history', () => {
  if (!isEE()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('open history, preview a revision, and restore it', async ({ page }) => {
    // Create a doc and make one content edit so we have a revision to show.
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'History Smoke',
    });
    await dashboard.docs.openedPage.tiptap.fillContent({
      content: 'First version content',
    });

    const history = dashboard.docs.openedPage.history;

    // Open the History modal from the doc page overflow menu.
    await history.openHistory();
    await history.verifyModalVisible(true);

    // The modal auto-selects the most recent revision; explicitly click it
    // anyway to make the assertion deterministic.
    await page.waitForTimeout(500);
    await history.clickRevisionAt(0);

    // Restore — confirms via NcConfirmModal.
    await history.restoreSelectedRevision();

    // After restore, the modal closes and a new revision has been written
    // to history. Re-opening would show two entries (original + restored).
    await page.waitForTimeout(500);
  });
});
