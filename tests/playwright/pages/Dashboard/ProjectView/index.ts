import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { DataSourcePage } from './DataSourcePage';
import { TablesViewPage } from './TablesViewPage';
import { AccessSettingsPage } from './AccessSettingsPage';
import { BaseSettingsPage } from './Settings';

export class ProjectViewPage extends BasePage {
  readonly dashboard: DashboardPage;

  // sub components
  readonly dataSources: DataSourcePage;
  readonly tables: TablesViewPage;
  readonly accessSettings: AccessSettingsPage;
  readonly settings: BaseSettingsPage;

  // assets
  readonly tab_allTables: Locator;
  readonly tab_dataSources: Locator;
  readonly tab_accessSettings: Locator;

  readonly btn_addNewTable: Locator;
  readonly btn_importData: Locator;
  readonly btn_addNewDataSource: Locator;
  readonly btn_share: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.tables = new TablesViewPage(this);
    this.dataSources = new DataSourcePage(this);
    this.accessSettings = new AccessSettingsPage(this);
    this.settings = new BaseSettingsPage(this);

    this.tab_allTables = this.get().locator('[data-testid="proj-view-tab__all-tables"]');
    this.tab_dataSources = this.get().locator('[data-testid="proj-view-tab__data-sources"]');
    this.tab_accessSettings = this.get().locator('[data-testid="proj-view-tab__access-settings"]');

    this.btn_addNewTable = this.get().locator('[data-testid="proj-view-btn__add-new-table"]');
    this.btn_importData = this.get().locator('[data-testid="proj-view-btn__import-data"]');
    this.btn_addNewDataSource = this.get().locator('.nc-btn-new-datasource');
    this.btn_share = this.get().locator('[data-testid="share-base-button"]');
  }

  get() {
    return this.dashboard.get().locator('.nc-base-view-tab');
  }

  async verifyAccess(role: string) {
    await this.get().waitFor({ state: 'visible' });

    // provide time for tabs to appear
    await this.rootPage.waitForTimeout(1000);

    expect(await this.tab_allTables.isVisible()).toBeTruthy();

    if (role.toLowerCase() === 'creator' || role.toLowerCase() === 'owner') {
      await this.tab_accessSettings.waitFor({ state: 'visible' });
      expect(await this.tab_dataSources.isVisible()).toBeTruthy();
    } else {
      expect(await this.tab_dataSources.isVisible()).toBeFalsy();
    }

    await this.tables.verifyAccess(role);
  }
}
