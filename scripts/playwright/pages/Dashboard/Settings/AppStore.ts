import { expect } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class AppStoreSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-nc="nc-settings-subtab-appStore"]`);
  }

  async install({ name }: { name: string }) {
    const card = await this.settings.get().locator(`.nc-app-store-card-${name}`);
    await card.click();
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
    const card = this.settings.get().locator(`.nc-app-store-card-${param.name}`);

    // await card.scrollIntoViewIfNeeded();
    await card.click();
    await card.locator('.nc-app-store-card-reset').click();
    await this.rootPage.locator('button.ant-btn-dangerous').click();
  }
}
