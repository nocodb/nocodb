import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { Locator } from '@playwright/test';

export class DataSourcePage extends BasePage {
  readonly projectView: ProjectViewPage;
  readonly databaseType: Locator;

  constructor(projectView: ProjectViewPage) {
    super(projectView.rootPage);
    this.projectView = projectView;
    this.databaseType = this.get().locator('.nc-extdb-db-type');
  }

  get() {
    return this.rootPage.locator('.nc-data-sources-view');
  }

  async getDatabaseTypeList() {
    await this.databaseType.click();
    const nodes = await this.rootPage.locator('.nc-dropdown-ext-db-type').locator('.ant-select-item');
    const list = [];
    for (let i = 0; i < (await nodes.count()); i++) {
      const node = nodes.nth(i);
      const text = await node.textContent();
      list.push(text);
    }
    return list;
  }

  async openERD({ rowIndex }: { rowIndex: number }) {
    // hardwired
    await this.rootPage.locator('button.nc-action-btn').nth(1).click();

    // const row = this.get().locator('.ds-table-row').nth(rowIndex);
    // await row.locator('.ds-table-actions').locator('button.nc-action-btn').waitFor();
    // await row.locator('.ds-table-actions').locator('button.nc-action-btn').nth(1).click();
  }
}
