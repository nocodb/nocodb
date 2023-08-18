import { Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';

export class LeftSidebarPage extends BasePage {
  readonly project: any;
  readonly dashboard: DashboardPage;

  readonly btn_newProject: Locator;
  readonly btn_cmdK: Locator;
  readonly btn_teamAndSettings: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.btn_newProject = this.get().locator('[data-testid="nc-sidebar-create-project-btn"]');
    this.btn_cmdK = this.get().locator('[data-testid="nc-sidebar-search-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  async clickTeamAndSettings() {
    await this.btn_teamAndSettings.click();
  }

  async clickHome() {}
}
