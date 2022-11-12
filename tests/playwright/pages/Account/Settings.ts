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
    await this.rootPage.goto('/?dummy=settings#/account/users/settings');
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-app-settings"]`);
  }

  getInviteOnlyCheckbox() {
    return this.get().locator(`.nc-invite-only-signup-checkbox`);
  }

  async checkInviteOnlySignupCheckbox(value: boolean) {
    return expect(await this.get().locator(`.nc-invite-only-signup-checkbox`).isChecked()).toBe(value);
  }

  async toggleInviteOnlyCheckbox() {
    await this.getInviteOnlyCheckbox().click();
    await this.verifyToast({ message: 'Settings saved successfully' });
  }
}
