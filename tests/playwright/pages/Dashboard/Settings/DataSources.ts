import { SettingsPage } from '.';
import { defaultBaseName } from '../../../constants';
import BasePage from '../../Base';
import { AclPage } from './Acl';
import { SettingsErdPage } from './Erd';
import { MetaDataPage } from '../ProjectView/Metadata';

export class DataSourcesPage extends BasePage {
  private readonly settings: SettingsPage;
  readonly erd: SettingsErdPage;
  readonly acl: AclPage;
  readonly metaData: MetaDataPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
    this.erd = new SettingsErdPage(this);
    this.acl = new AclPage(this);
    this.metaData = new MetaDataPage(this);
  }

  get() {
    return this.settings.get().locator('[data-testid="nc-settings-datasources"]');
  }

  async openErd({ rowIndex }: { rowIndex: number }) {
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.click();
    await this.get().getByTestId('nc-erd-tab').click();
  }

  async openAudit({ rowIndex }: { rowIndex: number }) {
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.click();
    await this.get().getByTestId('nc-audit-tab').click();
  }

  async openAcl({ dataSourceName = defaultBaseName }: { dataSourceName?: string } = {}) {
    await this.get().locator('.ds-table-row', { hasText: dataSourceName }).click();
    await this.get().locator('[data-testid="nc-acl-tab"]').click();
  }

  async openMetaSync({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.click();
    await this.get().getByTestId('nc-meta-sync-tab').click();
  }
}
