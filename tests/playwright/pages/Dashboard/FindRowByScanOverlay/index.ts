import { Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { ToolbarPage } from '../common/Toolbar';

export class FindRowByScanOverlay extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly selectColumnDropdown: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = dashboard.grid.toolbar;
    this.selectColumnDropdown = this.dashboard.get().locator('.nc-dropdown-scanner-column-id');
  }

  get() {
    return this.dashboard.get().locator(`.nc-overlay-find-row-by-scan`);
  }

  async isVisible() {
    return await this.get().isVisible();
  }

  async scannerScreenIsVisible() {
    return await this.get().locator(`.nc-scanner-screen`).isVisible();
  }

  async selectColumnToScan({ columnName }: { columnName: string }) {
    await this.selectColumnDropdown.click();
    await this.selectColumnDropdown.selectOption({ label: columnName });
  }
}
