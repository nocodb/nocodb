import BasePage from '../../Base';
import { DashboardPage } from '..';

export class CmdJ extends BasePage {
  readonly dashboardPage: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboardPage = dashboard;
  }

  get() {
    return this.dashboardPage.get().locator('.cmdj-modal');
  }

  async openCmdJ() {
    await this.dashboardPage.rootPage.keyboard.press((await this.isMacOs()) ? 'Meta+J' : 'Control+J');
    // await this.dashboardPage.rootPage.waitForSelector('.DocSearch-Input');
  }

  async searchText(text: string) {
    await this.dashboardPage.rootPage.fill('.cmdj-input', text);
  }

  async isCmdJVisible() {
    const isVisible = this.get();
    return await isVisible.count();
  }

  async isCmdJNotVisible() {
    const isNotVisible = this.get();
    return await isNotVisible.count();
  }

  async getPlaceholderText() {
    const placeholderText = this.get().locator('.DocSearch-Input');
    return await placeholderText.innerText();
  }
}
