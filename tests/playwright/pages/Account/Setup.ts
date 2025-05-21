import BasePage from '../Base';
import { AccountPage } from './index';
import { AccountSetupConfigPage } from './SetupConfig';
import { AccountSetupListPage } from './SetupList';
import { expect } from '@playwright/test';

export class AccountSetupPage extends BasePage {
  private accountPage: AccountPage;
  private setupConfigPage: AccountSetupConfigPage;
  private setupListPage: AccountSetupListPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.setupConfigPage = new AccountSetupConfigPage(this);
    this.setupListPage = new AccountSetupListPage(this);
  }

  async goto() {
    await this.rootPage.goto('/#/account/setup');
    await this.rootPage.locator(`[data-test-id="nc-setup"]`).isVisible();
  }

  get() {
    return this.accountPage.get().getByTestId('nc-setup');
  }

  getCategoryCard(key: 'email' | 'storage' = 'email') {
    return this.get().getByTestId(`nc-setup-${key}`);
  }

  async isConfigured(key: 'email' | 'storage' = 'email', isConfigured = true) {
    return await expect(this.getCategoryCard(key).locator('.nc-configured')).toHaveCount(isConfigured ? 1 : 0);
  }

  async configure({
    key = 'email',
    plugin,
    config,
  }: {
    key: 'email' | 'storage';
    plugin: string;
    config: Record<string, any>;
  }) {
    await this.getCategoryCard(key).click();
    await this.setupListPage.getPluginItem(plugin).click();
    await this.setupConfigPage.fillForm(config);
    await this.setupConfigPage.save();
  }

  async confirmReset() {
    return this.rootPage.locator('.nc-modal-plugin-reset-conform').getByTestId('nc-reset-confirm-btn').click();
  }

  async resetConfig({ plugin, key }: { plugin: string; key: string }) {
    await this.getCategoryCard(key).click();
    await this.setupListPage.reset(plugin);
    await this.confirmReset();
  }
}
