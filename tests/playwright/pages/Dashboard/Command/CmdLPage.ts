import BasePage from '../../Base';
import { DashboardPage } from '..';

export class CmdL extends BasePage {
  readonly dashboardPage: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboardPage = dashboard;
  }

  get() {
    return this.dashboardPage.get().locator('.cmdl-modal.cmdl-modal-active');
  }

  async openCmdL() {
    await this.dashboardPage.rootPage.keyboard.press(this.isMacOs() ? 'Meta+L' : 'Control+L');
  }

  async isCmdLVisible() {
    const isVisible = this.get();
    return await isVisible.count();
  }

  async isCmdLNotVisible() {
    const isNotVisible = this.get();
    return await isNotVisible.count();
  }

  async moveDown() {
    await this.dashboardPage.rootPage.keyboard.press('ArrowDown');
  }

  async moveUp() {
    await this.dashboardPage.rootPage.keyboard.press('ArrowUp');
  }

  async openRecent() {
    await this.dashboardPage.rootPage.keyboard.press('Enter');
  }

  async getActiveViewTitle() {
    return await this.dashboardPage.get().locator('.nc-active-view-title').innerText();
  }

  async getActiveTableTitle() {
    return await this.dashboardPage.get().locator('.nc-active-table-title').innerText();
  }
}
