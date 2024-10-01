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
    await this.dashboardPage.rootPage.keyboard.press((await this.isMacOs()) ? 'Meta+K' : 'Control+K');
  }

  async searchText(text: string) {
    await this.dashboardPage.rootPage.fill('.cmdk-input', text);
    await this.dashboardPage.rootPage.waitForTimeout(1000);
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
