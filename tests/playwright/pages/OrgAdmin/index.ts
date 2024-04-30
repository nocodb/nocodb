import { Page } from '@playwright/test';
import BasePage from '../Base';
import { SSOPage } from './SSOPage';
import { DashboardPage } from '../Dashboard';

export class OrgAdminPage extends BasePage {
  readonly ssoPage: SSOPage;

  constructor(page: Page) {
    super(page);
    this.ssoPage = new SSOPage(page);
  }

  get() {
    return this.rootPage.locator('body');
  }
  async goto() {
    await this.rootPage.goto('/');
    await this.rootPage.getByTestId('nc-sidebar-userinfo').click();
    if ((await this.rootPage.getByTestId('nc-sidebar-upgrade-workspace-to-org').count()) > 0) {
      await this.rootPage.getByTestId('nc-sidebar-upgrade-workspace-to-org').first().click();
    } else {
      await this.rootPage.getByTestId('nc-sidebar-org-admin-panel').click();
    }
    await this.rootPage.waitForNavigation({ url: /\/#\/admin\/\w+/ });
  }
}
