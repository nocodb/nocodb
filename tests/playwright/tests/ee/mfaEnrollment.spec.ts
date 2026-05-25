import { expect, test } from '@playwright/test';
import setup, { NcContext, unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { AccountPage } from '../../pages/Account';
import { generateTotp } from '../utils/totp';

/**
 * Account → Security 2FA round-trip via the UI: enrol with the test
 * owner's password, verify the QR/secret/backup-code states, then
 * disable. Each test self-cleans (disables 2FA via the UI at the end)
 * so the test owner is left in the same state the next worker expects.
 *
 * The Cognito sign-in path is exercised through the same code paths
 * (mfa.service.setup / verifySetup) — the Cognito entry point is
 * separately gated by infra we don't run in playwright. Covering the
 * password flow here gives us regression coverage on the shared MFA
 * service.
 */

const DEFAULT_PWD = 'Password123.';

test.describe('Account → Security: 2FA enrolment', () => {
  let dashboard: DashboardPage;
  let accountPage: AccountPage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    accountPage = new AccountPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('enrol then disable round-trip', async () => {
    // ─── Pre-condition: Account → Security renders Enable 2FA ─────────
    await accountPage.security.goto();
    await expect(accountPage.security.enableBtn()).toBeVisible();
    await expect(accountPage.security.enableBtn()).toBeEnabled();

    // ─── Step 1: Enable 2FA → password modal ─────────────────────────
    await accountPage.security.clickEnable();
    await expect(accountPage.security.setupPasswordInput()).toBeVisible();

    // ─── Step 2: confirm password → QR + secret ──────────────────────
    await accountPage.security.fillSetupPasswordAndNext(DEFAULT_PWD);

    const secret = await accountPage.security.readSetupSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/); // base32

    // The QR image, the secret-as-text, and the copy button should all
    // be visible — sanity-check the structure of the QR step.
    await expect(accountPage.security.setupModal().locator('img')).toBeVisible();
    await expect(dashboard.rootPage.getByTestId('nc-2fa-copy-secret-btn')).toBeVisible();

    // ─── Step 3: Next → verify-code step ─────────────────────────────
    await accountPage.security.clickNextOnQr();
    await expect(accountPage.security.setupCodeInput()).toBeVisible();

    // ─── Step 4: submit TOTP → backup-codes screen with N codes ──────
    const code = generateTotp(secret);
    await accountPage.security.fillVerifyCodeAndSubmit(code);

    // Backend generates 10 backup codes by default (see generateBackupCodes)
    await accountPage.security.waitForBackupCodes(10);
    const backupCodes = await accountPage.security.readBackupCodes();
    expect(backupCodes).toHaveLength(10);
    for (const c of backupCodes) {
      // Format is `xxxx-xxxx` (see generateBackupCodes in mfa.service.ts).
      expect(c).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    }

    // ─── Step 5: close modal → Disable 2FA button visible ────────────
    await accountPage.security.closeSetupAfterBackupCodes();
    await expect(accountPage.security.disableBtn()).toBeVisible();
    await expect(accountPage.security.enableBtn()).toHaveCount(0);

    // ─── Step 6: disable round-trip cleans up state ──────────────────
    await accountPage.security.clickDisable();
    await accountPage.security.fillDisablePasswordAndConfirm(DEFAULT_PWD);

    // Status flips back: Enable button returns, Disable is gone.
    await expect(accountPage.security.enableBtn()).toBeVisible();
    await expect(accountPage.security.disableBtn()).toHaveCount(0);
  });
});
