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

  test('confirming the warning enforces 2FA on the owner immediately', async () => {
    await dashboard.workspaceSettings.open();

    const toggle = dashboard.workspaceSettings.forceTwoFactorToggle();
    const confirmModal = dashboard.rootPage.locator('.nc-modal-confirm-type-warning:visible');
    const mfaModal = dashboard.rootPage.locator('.nc-modal-confirm:visible', {
      hasText: 'Two-Factor Authentication Required',
    });

    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Open the warning, confirm enable — PATCH lands and the toggle flips.
    await dashboard.workspaceSettings.clickForceTwoFactorToggle();
    await expect(confirmModal).toBeVisible();

    await dashboard.workspaceSettings.waitForResponse({
      uiAction: () => confirmModal.locator('.nc-modal-confirm-ok-btn').click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `/api/v1/workspaces/`,
    });

    // Owner has no 2FA — once force_2fa is on, the next workspace request
    // returns 403 ERR_MFA_SETUP_REQUIRED and the EE interceptor opens the
    // setup dialog. If the regression returned, this assertion would fail
    // because the owner would silently keep workspace access.
    await expect(mfaModal).toBeVisible();
  });
});
