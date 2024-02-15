import BasePage from '../../Base';
import { DashboardPage } from '..';
import { expect } from '@playwright/test';

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
    await this.dashboardPage.rootPage.keyboard.press((await this.isMacOs()) ? 'Meta+l' : 'Control+l');
  }

  async isCmdLVisible() {
    await expect(this.get()).toBeVisible();
  }

  async isCmdLNotVisible() {
    await expect(this.get()).toBeHidden();
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
