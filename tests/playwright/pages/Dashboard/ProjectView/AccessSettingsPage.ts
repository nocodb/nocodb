import BasePage from '../../Base';
import { ProjectViewPage } from './index';

export class AccessSettingsPage extends BasePage {
  readonly baseView: ProjectViewPage;

  constructor(baseView: ProjectViewPage) {
    super(baseView.rootPage);
    this.baseView = baseView;
  }

  get() {
    return this.rootPage.locator('.nc-access-settings-view');
  }

  async setRole(email: string, role: string, networkValidation = true) {
    await this.get().locator('.user-row').nth(0).waitFor({ state: 'visible' });
    const userCount = await this.get().locator('.user-row').count();

    for (let i = 0; i < userCount; i++) {
      const user = this.get().locator('.user-row').nth(i);
      const userEmail = (await user.locator('.users-email-grid').innerText()).split('\n').pop();

      if (userEmail === email) {
        const roleDropdown = user.locator('.nc-roles-selector');

        const selectedRole = await user.locator('.nc-roles-selector').innerText();

        await roleDropdown.click();
        const menu = this.rootPage.locator('.nc-role-select-dropdown:visible');
        const clickClbk = () => menu.locator(`.nc-role-select-${role.toLowerCase()}:visible`).last().click();

        if (networkValidation && !selectedRole.includes(role)) {
          await this.waitForResponse({
            uiAction: clickClbk,
            requestUrlPathToMatch: '/users',
            httpMethodsToMatch: ['POST'],
          });
        } else {
          await this.rootPage.waitForTimeout(500);
        }

        break;
      }
    }
  }
}
