import BasePage from '../../Base';
import { DashboardPage } from '..';

export class CmdK extends BasePage {
  readonly dashboardPage: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboardPage = dashboard;
  }

  get() {
    return this.dashboardPage.get().locator('.cmdk-modal.cmdk-modal-active');
  }

  async openCmdK() {
    await this.dashboardPage.rootPage.keyboard.press(this.isMacOs() ? 'Meta+K' : 'Control+K');
    // await this.dashboardPage.rootPage.waitForSelector('.DocSearch-Input');
  }

  async searchText(text: string) {
    await this.dashboardPage.rootPage.fill('.cmdk-input', text);
    await this.rootPage.keyboard.press('Enter');
    await this.rootPage.keyboard.press('Enter');
  }

  async isCmdKVisible() {
    const isVisible = this.get();
    return await isVisible.count();
  }

  async isCmdKNotVisible() {
    const isNotVisible = this.get();
    return await isNotVisible.count();
  }
}
