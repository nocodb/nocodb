import { Page } from '@playwright/test';
import BasePage from '../Base';
import { SSOPage } from './SSOPage';
import { SidebarUserMenuObject } from '../Dashboard/Sidebar/UserMenu';
import { SidebarPage } from '../Dashboard/Sidebar';
import { DashboardPage } from '../Dashboard';

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

  async goto() {
    await this.rootPage.goto('/');

    const dashboardPage = new DashboardPage(this.rootPage);
    await dashboardPage.sidebar.userMenu.click();
  }
}
