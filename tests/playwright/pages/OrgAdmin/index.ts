import { Page } from '@playwright/test';
import BasePage from '../Base';
import { SSOPage } from './SSOPage';

export class AccountPage extends BasePage {
  readonly ssoPage: SSOPage;

  constructor(page: Page) {
    super(page);
    this.ssoPage = new SSOPage(this);
  }

  get() {
    return this.rootPage.locator('body');
  }

  async openAppMenu() {
    await this.rootPage.locator('.nc-menu-accounts').click();
  }

  async signOut() {
    await this.openAppMenu();
    await this.rootPage.locator('div.nc-account-dropdown-item:has-text("Sign Out"):visible').click();
    await this.rootPage.locator('[data-testid="nc-form-signin"]:visible').waitFor();
  }
}
