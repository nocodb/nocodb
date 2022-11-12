import { Locator } from '@playwright/test';
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
    await this.rootPage.goto('/?dummy=users#/account/tokens');
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

  async openRowActionMenu({ description }: { description: string }) {
    const userRow = this.get().locator(`tr:has-text("${description}")`);
    return userRow.locator(`.nc-token-menu`).click();
  }

  async deleteToken({ description }: { description: string }) {
    await this.openRowActionMenu({ description });
    await this.rootPage.locator('[data-testid="nc-token-row-action-icon"] .nc-delete-token').click();
    await this.rootPage.locator('.ant-modal-confirm-confirm button:has-text("Ok")').click();
    await this.verifyToast({ message: 'Token deleted successfully' });
  }
}
