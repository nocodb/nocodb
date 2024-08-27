import BasePage from '../Base';
import { AccountSetupPage } from './Setup';

export class AccountSetupConfigPage extends BasePage {
  private setupPage: AccountSetupPage;

  constructor(setupPage: AccountSetupPage) {
    super(setupPage.rootPage);
    this.setupPage = setupPage;
  }

  async goto(category: 'email' | 'storage', plugin: string) {
    await this.rootPage.goto(`/#/account/setup/${category}/${plugin}`);
  }

  get() {
    return this.setupPage.get().locator(`[data-test-id="nc-setup-config"]`);
  }

  async fillForm(data: any) {
    for (const key in data) {
      const fieldWrapper = this.get().locator(`[data-test-id="nc-form-input-${key}"]`);
      // if switch then toggle
      if (await fieldWrapper.locator('.ant-switch').isVisible()) {
        if (data[key]) {
          await fieldWrapper.locator('.ant-switch').click();
        }
      } else if (await fieldWrapper.locator('.ant-select').isVisible()) {
        await fieldWrapper.locator('.ant-select').click();
        await this.rootPage
          .locator(`[data-test-id="nc-form-input-${key}"] .ant-select-item:has-text("${data[key]}")`)
          .click();
      } else {
        await fieldWrapper.locator('input').fill(data[key]);
      }
    }
  }
  async test() {
    await this.get().getByTestId('nc-setup-config-action-test').click();
  }

  async Save() {
    await this.get().getByTestId('nc-setup-config-action-save').click();
  }
}
