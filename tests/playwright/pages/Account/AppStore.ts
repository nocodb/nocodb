import { expect } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountAppStorePage extends BasePage {
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
  }

  async goto() {
    await this.rootPage.goto('/#/account/apps', { waitUntil: 'networkidle' });
  }

  async waitUntilContentLoads() {
    return this.rootPage.waitForResponse(
      resp => resp.url().includes('api/v1/db/meta/plugins') && resp.status() === 200
    );
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-settings-subtab-appStore"]`);
  }

  async install({ name }: { name: string }) {
    const card = await this.accountPage.get().locator(`.nc-app-store-card-${name}`);
    await card.click();

    // todo: Hack to solve the issue when if the test installing a plugin fails, the next test will fail because the plugin is already installed
    let appAlreadyInstalled = true;
    for (let i = 0; i < 5; i++) {
      if (await card.locator('.nc-app-store-card-install').isVisible()) {
        appAlreadyInstalled = false;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (appAlreadyInstalled) {
      await this.uninstall({ name });
    }

    await card.locator('.nc-app-store-card-install').click();
  }

  async configureSlack() {}

  async configureSMTP({ email, host, port }: { email: string; host: string; port: string }) {
    const appStoreCard = this.rootPage.locator('.nc-modal-plugin-install');

    await appStoreCard.locator('[id="form_item_from"]').fill(email);
    await appStoreCard.locator('[id="form_item_host"]').fill(host);
    await appStoreCard.locator('[id="form_item_port"]').fill(port);

    await appStoreCard.locator('button:has-text("Save")').click();
  }

  async uninstall(param: { name: string }) {
    const card = this.accountPage.get().locator(`.nc-app-store-card-${param.name}`);

    // await card.scrollIntoViewIfNeeded();
    await card.click();
    await card.locator('.nc-app-store-card-reset').click();
    await this.rootPage.locator('button.ant-btn-dangerous').click();
  }
}
