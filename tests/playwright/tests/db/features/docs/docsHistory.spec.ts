import { test } from '@playwright/test';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import { isEE } from '../../../../setup/db';

/**
 * End-to-end smoke for doc revision history. Relies on the backend test
 * harness running with `NC_DOC_REVISION_COALESCE_WINDOW_MS=0` so each save
 * lands as a distinct revision row — otherwise edits by the same author
 * within 2 minutes coalesce into one entry. The UI explicitly disables
 * Restore for the current (topmost) revision, so the test must select a
 * prior one before restoring.
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
    // Create a doc and make two distinct edits so we have at least two
    // revisions (one current + one prior) — the UI disables Restore when
    // the selected revision is the current version.
    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'History Smoke',
    });

    // First save → revision #1.
    await dashboard.docs.openedPage.tiptap.fillContent({
      content: 'First version content',
    });
    // Wait past the 2s autosave debounce so the save is flushed before the
    // next edit, otherwise both edits debounce into a single save.
    await page.waitForTimeout(2500);

    // Second save → revision #2 (becomes the current version).
    await dashboard.docs.openedPage.tiptap.fillContent({
      content: 'Second version content',
    });
    await page.waitForTimeout(2500);

    const history = dashboard.docs.openedPage.history;

    // Open the History modal from the doc page overflow menu.
    await history.openHistory();
    await history.verifyModalVisible(true);

    // Expect at least two revisions; row 0 is the current version, row 1
    // is the prior edit. Restore is disabled for row 0 by design.
    await history.verifyRevisionCount(2);
    await history.clickRevisionAt(1);

    // Restore — confirms via NcConfirmModal.
    await history.restoreSelectedRevision();
  });
});
