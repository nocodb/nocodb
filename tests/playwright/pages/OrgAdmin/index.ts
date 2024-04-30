import { Page } from '@playwright/test';
import BasePage from '../Base';
import { CloudSSO } from './SSO';

export class OrgAdminPage extends BasePage {
  readonly ssoPage: CloudSSO;

  constructor(page: Page) {
    super(page);
    this.ssoPage = new CloudSSO(this);
  }

  get() {
    return this.rootPage.locator('body');
  }
  async goto() {
    await this.rootPage.goto('/');
    await this.rootPage.getByTestId('nc-sidebar-userinfo').click();

    await this.rootPage.waitForTimeout(1000);

    if ((await this.rootPage.getByTestId('nc-sidebar-upgrade-workspace-to-org').count()) > 0) {
      await this.rootPage.getByTestId('nc-sidebar-upgrade-workspace-to-org').first().click();
    } else {
      await this.rootPage.getByTestId('nc-sidebar-org-admin-panel').click();
    }
    await this.rootPage.waitForNavigation({ url: /\/#\/admin\/\w+/ });
  }
}
