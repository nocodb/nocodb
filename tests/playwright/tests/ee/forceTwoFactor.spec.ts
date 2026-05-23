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

  test('warns the admin before enabling and respects cancel/confirm', async () => {
    await dashboard.workspaceSettings.open();

    const toggle = dashboard.workspaceSettings.forceTwoFactorToggle();
    // Scope to :visible — useDialog defers unmount by 1s after close, so a
    // dismissed modal lingers in the DOM and a plain `.nc-modal-confirm`
    // locator would match both the old hidden one and the newly-opened one.
    const modal = dashboard.rootPage.locator('.nc-modal-confirm:visible');

    // Sanity: starts off
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // 1. Cancel path — clicking toggle opens a warning, cancel leaves it off
    await dashboard.workspaceSettings.clickForceTwoFactorToggle();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.nc-modal-confirm-title')).toContainText('Require two-factor');
    // Owner has no 2FA in the test fixture, so we should get the "you will be
    // locked out" copy — the regression we're guarding against.
    await expect(modal.locator('.nc-modal-confirm-content')).toContainText('locked out');

    await modal.locator('.nc-modal-confirm-cancel-btn').click();
    await expect(modal).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // 2. Confirm path — clicking OK actually flips the toggle and persists
    await dashboard.workspaceSettings.clickForceTwoFactorToggle();
    await expect(modal).toBeVisible();

    await dashboard.workspaceSettings.waitForResponse({
      uiAction: () => modal.locator('.nc-modal-confirm-ok-btn').click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `/api/v1/workspaces/`,
    });

    await expect(modal).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // 3. Turning it OFF must NOT show the confirm — it's only when enabling.
    await dashboard.workspaceSettings.waitForResponse({
      uiAction: () => dashboard.workspaceSettings.clickForceTwoFactorToggle(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `/api/v1/workspaces/`,
    });
    await expect(modal).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
