import { expect, Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountTokenPage extends BasePage {
  readonly createBtn: Locator;
  readonly createModal: Locator;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.createBtn = this.get().locator(`[data-testid="nc-token-create"]`);
    this.createModal = accountPage.rootPage.locator(`.nc-modal-generate-token`);
  }

  async goto() {
    return this.waitForResponse({
      uiAction: async () => await this.rootPage.goto('/#/account/tokens'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/tokens`,
    });
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-token-list"]`);
  }

  async createToken({ description }: { description: string }) {
    await this.createBtn.click();
    await this.createModal.locator(`input[placeholder="Description"]`).fill(description);
    await this.createModal.locator(`[data-testid="nc-token-modal-save"]`).click();
    await this.verifyToast({ message: 'Token generated successfully' });
  }

  getTokenRow({ idx = 0 }) {
    return this.get().locator(`tr:nth-child(${idx})`);
  }

  async toggleVisibility({ idx = 0 }) {
    const row = this.getTokenRow({ idx });
    await row.locator('.nc-toggle-token-visibility').click();
  }

  async openRowActionMenu({ description }: { description: string }) {
    const userRow = this.get().locator(`tr:has-text("${description}")`);
    return userRow.locator(`.nc-token-menu`).click();
  }

  async deleteToken({ description }: { description: string }) {
    await this.openRowActionMenu({ description });
    await this.rootPage.locator('[data-testid="nc-token-row-action-icon"] .nc-delete-token').click();
    await this.rootPage.locator('.ant-modal.active button:has-text("Delete Token")').click();
    await this.verifyToast({ message: 'Token deleted successfully' });

    expect(await this.get().locator(`tr:has-text("${description}:visible")`).count()).toBe(0);
  }
}
