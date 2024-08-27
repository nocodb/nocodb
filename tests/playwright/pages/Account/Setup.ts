import BasePage from '../Base';
import { AccountPage } from './index';
import { AccountSetupConfigPage } from './SetupConfig';
import { AccountSetupListPage } from './SetupList';

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
    await this.rootPage.locator(`[data-test-id="nc-setup"]`).waitForElementState('visible');
  }

  get() {
    return this.accountPage.get().locator(`[data-test-id="nc-setup"]`);
  }

  openEmailSettings() {}

  getCategoryCard(key: 'email' | 'storage' = 'email') {
    return this.get().getByTestId(`nc-setup-${key}`);
  }

  async isConfigured(key: 'email' | 'storage' = 'email') {
    return await this.getCategoryCard(key).locator('.nc-configured').isVisible();
  }

  async configure(key: 'email' | 'storage' = 'email') {
    await this.getCategoryCard(key).locator('.nc-setup-btn').click();
  }
}
