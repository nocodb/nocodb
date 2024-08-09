import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { Locator } from '@playwright/test';
import { MetaDataPage } from './Metadata';
import { AuditPage } from './Audit';
import { SourcePage } from './SourcePage';
import { AclPage } from './Acl';
import { defaultBaseName } from '../../../constants';

export class DataSourcePage extends BasePage {
  readonly baseView: ProjectViewPage;
  readonly databaseType: Locator;
  readonly metaData: MetaDataPage;
  readonly audit: AuditPage;
  readonly source: SourcePage;
  readonly acl: AclPage;

  constructor(baseView: ProjectViewPage) {
    super(baseView.rootPage);
    this.baseView = baseView;
    this.databaseType = this.get().locator('.nc-extdb-db-type');
    this.metaData = new MetaDataPage(this);
    this.audit = new AuditPage(this);
    this.source = new SourcePage(this);
    this.acl = new AclPage(this);
  }

  get() {
    return this.rootPage.locator('.nc-data-sources-view');
  }

  getDsDetailsModal() {
    return this.rootPage.locator('.nc-active-data-sources-view');
  }

  async closeDsDetailsModal() {
    await this.getDsDetailsModal().locator('.nc-close-btn').click();
    await this.getDsDetailsModal().waitFor({ state: 'hidden' });
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

    await row.click();

    await this.getDsDetailsModal().waitFor({ state: 'visible' });
    await this.getDsDetailsModal().getByTestId('nc-meta-sync-tab').click();
    // await row.getByTestId('nc-data-sources-view-meta-sync').click();
  }

  async openERD({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);

    await row.click();

    // kludge: only in testing it's not rendering all tables
    await this.getDsDetailsModal().getByTestId('nc-acl-tab').click();
    await this.getDsDetailsModal().getByTestId('nc-erd-tab').click();
  }

  async openAudit({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);

    await row.click();

    await this.getDsDetailsModal().waitFor({ state: 'visible' });
    await this.getDsDetailsModal().getByTestId('nc-audit-tab').click();

    // await row.getByTestId('nc-data-sources-view-audit').click();
  }

  async openEditConnection({ sourceName }: { sourceName: string }) {
    await this.get().locator('.ds-table-row', { hasText: sourceName }).click();

    await this.getDsDetailsModal().waitFor({ state: 'visible' });
    await this.getDsDetailsModal().getByTestId('nc-connection-tab').click();

    await this.getDsDetailsModal().locator('.nc-general-overlay').first().waitFor({ state: 'hidden' });
  }

  async openAcl({ dataSourceName = defaultBaseName }: { dataSourceName?: string } = {}) {
    await this.get().locator('.ds-table-row', { hasText: dataSourceName }).click();

    await this.getDsDetailsModal().waitFor({ state: 'visible' });
    await this.getDsDetailsModal().getByTestId('nc-acl-tab').click();
  }
}
