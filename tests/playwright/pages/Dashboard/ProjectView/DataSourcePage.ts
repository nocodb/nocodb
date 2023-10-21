import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { Locator } from '@playwright/test';
import { MetaDataPage } from './Metadata';
import { AuditPage } from './Audit';

export class DataSourcePage extends BasePage {
  readonly baseView: ProjectViewPage;
  readonly databaseType: Locator;
  readonly metaData: MetaDataPage;
  readonly audit: AuditPage;

  constructor(baseView: ProjectViewPage) {
    super(baseView.rootPage);
    this.baseView = baseView;
    this.databaseType = this.get().locator('.nc-extdb-db-type');
    this.metaData = new MetaDataPage(this);
    this.audit = new AuditPage(this);
  }

  get() {
    return this.rootPage.locator('.nc-data-sources-view');
  }

  async getDatabaseTypeList() {
    await this.databaseType.click();
    const nodes = this.rootPage.locator('.nc-dropdown-ext-db-type').locator('.ant-select-item');
    const list = [];
    for (let i = 0; i < (await nodes.count()); i++) {
      const node = nodes.nth(i);
      const text = await node.textContent();
      list.push(text);
    }
    return list;
  }

  async openMetaSync({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.getByTestId('nc-data-sources-view-meta-sync').click();
  }

  async openERD({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.getByTestId('nc-data-sources-view-erd').click();
  }

  async openAudit({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.getByTestId('nc-data-sources-view-audit').click();
  }
}
