import { expect } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountSettingsPage extends BasePage {
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
  }

  async goto(p: { networkValidation: boolean }) {
    if (p.networkValidation) {
      return this.waitForResponse({
        uiAction: async () => await this.rootPage.goto('/#/account/users/settings'),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: `api/v1/app-settings`,
      });
    } else {
      await this.rootPage.goto('/#/account/users/settings');
      await this.rootPage.waitForTimeout(500);
    }
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-app-settings"]`);
  }

  getInviteOnlyCheckbox() {
    return this.get().locator(`.nc-invite-only-signup-checkbox`);
  }

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
