import { Page } from '@playwright/test';
import BasePage from '../Base';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get() {
    return this.rootPage.locator('body');
  }

  async openAppMenu() {
    await this.rootPage.locator('.nc-menu-accounts').click();
  }

  async signOut() {
    await this.openAppMenu();
    await this.rootPage.locator('div.nc-project-menu-item:has-text("Sign Out"):visible').click();
    await this.rootPage.locator('[data-testid="nc-form-signin"]:visible').waitFor();
  }
}
