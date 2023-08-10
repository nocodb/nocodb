import { Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class LeftSidebarPage extends BasePage {
  readonly project: any;
  readonly dashboard: DashboardPage;
  readonly home: Locator;
  readonly newProject: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.home = this.get().locator('[data-testid="nc-sidebar-home-btn"]');
    this.newProject = this.get().locator('[data-testid="nc-sidebar-create-project-btn"]');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  async clickHome() {
    await this.home.click();
  }
}
