import { expect, Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

/**
 * Page-object for `Account → Security` — covers the 2FA enrolment,
 * disable, and backup-codes affordances rendered by
 * `packages/nc-gui/ee/components/account/Security.vue`.
 *
 * Helpers are scoped to `:visible` where the design system defers
 * unmount (NcModal animations linger in the DOM for ~300ms after
 * close), so a re-opened modal would otherwise match the stale node.
 */
export class AccountSecurityPage extends BasePage {
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
  }

  async goto(query?: Record<string, string>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    await this.rootPage.goto(`/account/security${qs}`, { waitUntil: 'networkidle' });
    await this.enableBtn().or(this.disableBtn()).waitFor({ state: 'visible', timeout: 10000 });
  }

  get() {
    return this.accountPage.get();
  }

  // ─── top-level controls ──────────────────────────────────────────────

  enableBtn(): Locator {
    return this.rootPage.getByTestId('nc-2fa-enable-btn');
  }

  disableBtn(): Locator {
    return this.rootPage.getByTestId('nc-2fa-disable-btn');
  }

  async clickEnable() {
    await this.enableBtn().click();
  }

  async clickDisable() {
    await this.disableBtn().click();
  }

  // ─── setup wizard ────────────────────────────────────────────────────

  setupModal(): Locator {
    // NcModalConfirm renders into a `.nc-modal-confirm-wrapper` portal;
    // scope to :visible so a lingering dismissed modal doesn't match.
    return this.rootPage.locator('.nc-modal-confirm:visible');
  }

  setupPasswordInput(): Locator {
    return this.rootPage.getByTestId('nc-2fa-setup-password');
  }

  setupCodeInput(): Locator {
    return this.rootPage.getByTestId('nc-2fa-setup-code');
  }

  setupSecretCode(): Locator {
    // The secret is rendered inside a `<code>` block; the copy button
    // sits right next to it. Read the code element's text.
    return this.setupModal().locator('code').first();
  }

  async fillSetupPasswordAndNext(password: string) {
    await this.setupPasswordInput().fill(password);
    // The Next button is the primary one inside the password step's
    // footer row. The setup modal has no test-id on it but it lives
    // inside the .nc-modal-confirm:visible scope.
    await this.setupModal().locator('.ant-btn-primary', { hasText: /Next/i }).click();
    // QR step rendered when the manual-entry secret code appears.
    await this.setupSecretCode().waitFor({ state: 'visible', timeout: 5000 });
  }

  async readSetupSecret(): Promise<string> {
    await this.setupSecretCode().waitFor({ state: 'visible', timeout: 5000 });
    const text = (await this.setupSecretCode().textContent()) ?? '';
    return text.trim();
  }

  async clickNextOnQr() {
    await this.rootPage.getByTestId('nc-2fa-setup-qr-next-btn').click();
    await this.setupCodeInput().waitFor({ state: 'visible', timeout: 5000 });
  }

  async fillVerifyCodeAndSubmit(code: string) {
    await this.setupCodeInput().fill(code);
    await this.rootPage.getByTestId('nc-2fa-setup-verify-btn').click();
  }

  /** Backup-code grid (`<code>` cells under the step-3 layout). */
  setupBackupCodeCells(): Locator {
    return this.setupModal().locator('.grid code');
  }

  async waitForBackupCodes(expectedCount: number) {
    // Wait for the backup-codes screen to render — the "I have saved
    // these codes" button is the canonical signal we landed on step 3.
    await this.rootPage.getByTestId('nc-2fa-setup-confirm-saved-btn').waitFor({ state: 'visible', timeout: 5000 });
    await expect(this.setupBackupCodeCells()).toHaveCount(expectedCount);
  }

  async readBackupCodes(): Promise<string[]> {
    const cells = this.setupBackupCodeCells();
    const count = await cells.count();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (await cells.nth(i).textContent()) ?? '';
      out.push(t.trim());
    }
    return out;
  }

  async closeSetupAfterBackupCodes() {
    await this.rootPage.getByTestId('nc-2fa-setup-confirm-saved-btn').click();
    await expect(this.setupModal()).toHaveCount(0);
  }

  // ─── disable flow ────────────────────────────────────────────────────

  disableModal(): Locator {
    return this.rootPage.locator('.nc-modal-confirm:visible');
  }

  disablePasswordInput(): Locator {
    // The disable modal uses ant's <a-input-password> without a
    // data-testid — target it by role inside the visible modal.
    return this.disableModal().locator('input[type="password"]');
  }

  async fillDisablePasswordAndConfirm(password: string) {
    await this.disablePasswordInput().fill(password);
    // The danger-styled ok button on NcModalConfirm.
    await this.disableModal().locator('.nc-modal-confirm-ok-btn').click();
    await expect(this.disableModal()).toHaveCount(0);
  }
}
