import { Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { DataSourcePage } from './DataSourcePage';

export class ProjectViewPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly dataSources: DataSourcePage;
  readonly tab_allTables: Locator;
  readonly tab_dataSources: Locator;
  readonly btn_addNewTable: Locator;
  readonly btn_importData: Locator;
  readonly btn_addNewDataSource: Locator;
  readonly btn_share: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.dataSources = new DataSourcePage(this);

    this.tab_allTables = this.get().locator('[data-testid="proj-view-tab__all-tables"]');
    this.tab_dataSources = this.get().locator('[data-testid="proj-view-tab__data-sources"]');
    this.btn_addNewTable = this.get().locator('[data-testid="proj-view-btn__add-new-table"]');
    this.btn_importData = this.get().locator('[data-testid="proj-view-btn__import-data"]');
    this.btn_addNewDataSource = this.get().locator('.nc-btn-new-datasource');
    this.btn_share = this.get().locator('[data-testid="share-project-button"]');
  }

  get() {
    return this.dashboard.get().locator('.nc-project-view');
  }
}
