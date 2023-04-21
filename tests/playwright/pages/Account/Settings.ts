import { expect } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountSettingsPage extends BasePage {
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
  }

  async goto() {
    // await this.rootPage.goto('/#/account/users/settings', { waitUntil: 'networkidle' });
    await this.waitForResponse({
      uiAction: () => this.rootPage.goto('/#/account/users/settings', { waitUntil: 'networkidle' }),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/app-settings`,
    });
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-app-settings"]`);
  }

  getInviteOnlyCheckbox() {
    return this.get().locator(`.nc-invite-only-signup-checkbox`);
  }

  async getInviteOnlyCheckboxValue() {
    return this.get().locator(`.nc-invite-only-signup-checkbox`).isChecked();
  }

  async checkInviteOnlySignupCheckbox(value: boolean) {
    return expect(await this.getInviteOnlyCheckboxValue()).toBe(value);
  }

  async toggleInviteOnlyCheckbox() {
    await this.getInviteOnlyCheckbox().click();
    await this.verifyToast({ message: 'Settings saved successfully' });
  }
}
