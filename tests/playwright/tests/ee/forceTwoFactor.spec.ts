import { expect, test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';

test.describe('Force 2FA workspace setting', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('shows warning and respects cancel before enabling', async () => {
    await dashboard.workspaceSettings.open();

    const toggle = dashboard.workspaceSettings.forceTwoFactorToggle();
    // Scope to :visible — useDialog defers unmount by 1s after close, so a
    // dismissed modal lingers in the DOM and a plain `.nc-modal-confirm`
    // locator would match both the old hidden one and the newly-opened one.
    const modal = dashboard.rootPage.locator('.nc-modal-confirm:visible');

    // Sanity: starts off
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Clicking the toggle opens a warning naming the lock-out risk.
    await dashboard.workspaceSettings.clickForceTwoFactorToggle();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.nc-modal-confirm-title')).toContainText('Require two-factor');
    // Owner has no 2FA in the test fixture, so we should get the "you will be
    // locked out" copy — the regression we're guarding against.
    await expect(modal.locator('.nc-modal-confirm-content')).toContainText('locked out');

    // Cancel keeps the toggle off and does NOT fire a PATCH.
    await modal.locator('.nc-modal-confirm-cancel-btn').click();
    await expect(modal).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  // The confirm path (clicking Enable) intentionally locks the workspace owner
  // out of their own workspace. Asserting that here would leave force_2fa = true
  // on the seed workspace, and the next test's beforeEach can't clean it up
  // (PATCH/DELETE on the workspace also go through the MFA gate → 403). Backend
  // unit tests in packages/nocodb/tests/unit/rest/tests/ee/mfa.test.ts cover the
  // owner-no-longer-exempt regression instead.
});
