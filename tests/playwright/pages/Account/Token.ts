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
    await this.createInputDiv.locator(`[data-testid="nc-token-input"]`).fill(description);
    await this.createInputDiv.locator(`[data-testid="nc-token-save-btn"]`).click();
  }

  getTokenRow({ idx = 0 }) {
    return this.get().locator(`span:nth-child(${idx})`);
  }

  async toggleVisibility({ idx = 0 }) {
    const row = this.getTokenRow({ idx });
    await row.locator('.nc-toggle-token-visibility').click();
  }

  async deleteToken({ description }: { description: string }) {
    await this.rootPage.locator('[data-testid="nc-token-row-action-icon"]').click();
    await this.rootPage.locator('.ant-modal.active button:has-text("Delete Token")').click();

    expect(await this.get().locator(`span:has-text("${description}:visible")`).count()).toBe(0);
  }
}
