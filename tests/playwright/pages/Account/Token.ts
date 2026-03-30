import { expect, Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountTokenPage extends BasePage {
  readonly createBtn: Locator;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.createBtn = this.get().locator(`[data-testid="nc-token-create"]`);
  }

  async goto() {
    await this.rootPage.goto('/#/account/tokens');
    await this.rootPage.waitForLoadState('networkidle');
    await this.get().waitFor({ state: 'visible', timeout: 15000 });
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-token-list"]`);
  }

  async createToken({ description }: { description: string }) {
    // Click "Create new token" — navigates to /account/tokens/new
    await this.createBtn.first().click();

    // Wait for create form
    await this.rootPage.locator('[data-testid="nc-token-create-form"]').waitFor({ state: 'visible', timeout: 10000 });

    // Fill name
    await this.rootPage.locator('[data-testid="nc-token-name-input"]').fill(description);

    // Add a base scope (required for EE) — click "Add all resources"
    const addAllBtn = this.rootPage.locator('[data-testid="nc-token-scope-add-all"]');
    if (await addAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addAllBtn.click();
    }

    // Click "Create token"
    await this.rootPage.locator('[data-testid="nc-token-create-btn"]').click();

    // Wait for result modal with token value
    await this.rootPage.locator('[data-testid="nc-token-result-modal"]').waitFor({ state: 'visible', timeout: 15000 });

    // Copy and click Done
    await this.rootPage.locator('[data-testid="nc-token-copy-btn"]').click();
    await this.rootPage.locator('[data-testid="nc-token-done-btn"]').click();
    await this.rootPage.waitForTimeout(1000);
  }

  async deleteToken({ description }: { description: string }) {
    // Find the token row by description text
    const row = this.rootPage.locator('[data-testid="nc-token-list"] .token').filter({ hasText: description });

    if ((await row.count()) > 0) {
      // Click delete icon
      await row.locator('[data-testid="nc-token-row-action-icon"]').click();

      // Confirm in delete modal
      const confirmBtn = this.rootPage.locator('[data-testid="nc-delete-modal-delete-btn"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();
      await this.rootPage.waitForLoadState('networkidle');
      await this.rootPage.waitForTimeout(500);
    }
  }
}
