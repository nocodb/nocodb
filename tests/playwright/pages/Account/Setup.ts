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
    await this.rootPage.goto('/#/account/setup');
    await this.rootPage.locator(`[data-test-id="nc-setup"]`).waitForElementState('visible');
  }

  get() {
    return this.accountPage.get().locator(`[data-test-id="nc-setup"]`);
  }

  openEmailSettings() {}

  async getInviteOnlyCheckboxValue() {
    // allow time for the checkbox to be rendered
    await this.rootPage.waitForTimeout(1000);

    return this.get().locator(`.nc-invite-only-signup-checkbox`).isChecked({ timeout: 1000 });
  }

  async checkInviteOnlySignupCheckbox(value: boolean) {
    return expect(await this.getInviteOnlyCheckboxValue()).toBe(value);
  }

  async toggleInviteOnlyCheckbox() {
    await this.getInviteOnlyCheckbox().click();
    await this.verifyToast({ message: 'Settings saved successfully' });
  }
}
