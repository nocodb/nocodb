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
    return this.setupPage.get().getByTestId('nc-setup-config');
  }

  async fillForm(data: any) {
    for (const key in data) {
      const fieldWrapper = this.get().getByTestId(`nc-form-input-${key}`);
      // if switch then toggle
      if (await fieldWrapper.locator('.ant-switch').isVisible()) {
        if (data[key]) {
          await fieldWrapper.locator('.ant-switch').click();
        }
      } else {
        await fieldWrapper.locator('input').focus();
        await fieldWrapper.locator('input').fill(data[key]?.toString?.());
      }
    }
  }
  async test() {
    await this.get().getByTestId('nc-setup-config-action-test').click();
  }

  async save() {
    await this.get().getByTestId('nc-setup-config-action-save').click();
  }
}
