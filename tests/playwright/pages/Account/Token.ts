import { expect, Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountTokenPage extends BasePage {
  readonly createBtn: Locator;
  readonly createInputDiv: Locator;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.createBtn = this.get().locator(`[data-testid="nc-token-create"]`);
    this.createInputDiv = accountPage.rootPage.locator(`.nc-token-generate`);
  }

  async goto() {
    await this.rootPage.goto('/#/account/tokens');
    await this.rootPage.waitForLoadState('networkidle');
    await this.get().waitFor({ state: 'visible', timeout: 15000 });
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-token-list"]`);
  }

  private async isEeDropdown(): Promise<boolean> {
    // In EE mode, clicking create shows a dropdown with "Fine-grained" and "Legacy" options
    // In CE mode, it shows an inline input row directly
    await this.createBtn.click();
    const fineGrainedItem = this.rootPage.locator('[data-testid="nc-token-create-fine-grained"]');
    try {
      await fineGrainedItem.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async createToken({ description }: { description: string }) {
    const isEe = await this.isEeDropdown();

    if (isEe) {
      // EE: dropdown → Fine-grained → 3-step wizard
      await this.rootPage.locator('[data-testid="nc-token-create-fine-grained"]').click();
      await this.rootPage
        .locator('[data-testid="nc-token-create-wizard"]')
        .waitFor({ state: 'visible', timeout: 10000 });
      await this.rootPage.locator('[data-testid="nc-token-name-input"]').fill(description);
      await this.rootPage.locator('[data-testid="nc-token-wizard-next"]').click();
      // Step 2 — Scope: keep default
      await this.rootPage.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible', timeout: 5000 });
      await this.rootPage.locator('[data-testid="nc-token-wizard-next"]').click();
      // Step 3 — Permissions: select Full access
      await this.rootPage
        .locator('[data-testid="nc-token-wizard-step-3"]')
        .waitFor({ state: 'visible', timeout: 5000 });
      await this.rootPage.locator('[data-testid="nc-token-perm-preset-allwrite"]').click();
      await this.rootPage.locator('[data-testid="nc-token-wizard-create"]').click();
      // Result step
      await this.rootPage
        .locator('[data-testid="nc-token-wizard-result"]')
        .waitFor({ state: 'visible', timeout: 15000 });
      await this.rootPage.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
      await this.rootPage.waitForTimeout(1000);
    } else {
      // CE: inline input row
      await this.createInputDiv.locator(`[data-testid="nc-token-input"]`).fill(description);
      await this.createInputDiv.locator(`[data-testid="nc-token-save-btn"]`).click();
    }
  }

  getTokenRow({ idx = 0 }) {
    return this.get().locator(`span:nth-child(${idx})`);
  }

  async toggleVisibility({ idx = 0 }) {
    const row = this.getTokenRow({ idx });
    await row.locator('.nc-toggle-token-visibility').click();
  }

  async deleteToken({ description }: { description: string }) {
    // Try EE pattern first: NcTable row → three-dot menu → Delete menu item → confirm modal
    const row = this.rootPage.locator('tr.nc-table-row').filter({ hasText: description });
    const isEeTable = (await row.count()) > 0;

    if (isEeTable) {
      await row.locator('[data-testid="nc-token-row-action-icon"]').click();
      await this.rootPage.locator('.ant-dropdown:visible .nc-menu-item:has-text("Delete")').click();
      const confirmBtn = this.rootPage.locator('[data-testid="nc-delete-modal-delete-btn"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();
      await this.rootPage.waitForLoadState('networkidle');
      await this.rootPage.waitForTimeout(500);
    } else {
      // CE: direct delete icon → modal
      await this.rootPage.locator('[data-testid="nc-token-row-action-icon"]').click();
      await this.rootPage.locator('.ant-modal.active button:has-text("Delete Token")').click();
    }

    // Verify token is gone
    await expect(this.rootPage.locator(`tr.nc-table-row:has-text("${description}")`)).toHaveCount(0, {
      timeout: 10000,
    });
  }
}
