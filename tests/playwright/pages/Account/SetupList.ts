import BasePage from '../Base';
import { AccountSetupPage } from './Setup';

export class AccountSetupListPage extends BasePage {
  private setupPage: AccountSetupPage;

  constructor(setupPage: AccountSetupPage) {
    super(setupPage.rootPage);
    this.setupPage = setupPage;
  }

  async goto(category: 'email' | 'storage') {
    await this.rootPage.goto(`/#/account/setup/${category}`);
  }

  get() {
    return this.setupPage.get().locator(`[data-testid="nc-setup-list"]`);
  }

  getPluginItem(plugin: string) {
    return this.get().locator(`[data-testid="nc-setup-list-item-${plugin}"]`);
  }

  async isConfigured(plugin: string) {
    return await this.getPluginItem(plugin).locator('.nc-configured').isVisible();
  }

  async reset(plugin: string) {
    await this.getPluginItem(plugin).locator('.nc-setup-plugin-menu').click();
    await this.rootPage.locator('.ant-dropdown').getByTestId('nc-config-reset').click();
  }
}
