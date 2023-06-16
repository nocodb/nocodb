import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountLicensePage extends BasePage {
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
  }

  goto() {
    return this.rootPage.goto('/#/account/license');
  }

  waitUntilContentLoads() {
    return this.rootPage.waitForResponse(resp => resp.url().includes('api/v1/license') && resp.status() === 200);
  }

  // License TextBox
  get() {
    return this.accountPage.get().locator(`textarea[placeholder="License key"]`);
  }

  // Save button
  getSaveButton() {
    return this.accountPage.get().locator(`button.ant-btn-primary:has-text("Save license key")`);
  }

  async saveLicenseKey(licenseKey: string) {
    await this.get().fill(licenseKey);
    await this.getSaveButton().click();
    await this.verifyToast({ message: 'License key updated' });
  }
}
