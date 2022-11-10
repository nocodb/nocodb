import { SettingsPage } from '.';
import { defaultBaseName } from '../../../constants';
import BasePage from '../../Base';
import { AclPage } from './Acl';
import { SettingsErdPage } from './Erd';
import { MetaDataPage } from './Metadata';

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
    return this.settings.get().locator(`[data-nc="nc-settings-subtab-Data Sources"]`);
  }

  async openErd({ dataSourceName }: { dataSourceName: string }) {
    await this.get().locator('.ds-table-row', { hasText: dataSourceName }).locator('button:has-text("ERD")').click();
  }

  async openAcl({ dataSourceName = defaultBaseName }: { dataSourceName?: string } = {}) {
    await this.get().locator('.ds-table-row', { hasText: dataSourceName }).locator('button:has-text("UI ACL")').click();
  }

  async openMetaSync({ dataSourceName = defaultBaseName }: { dataSourceName?: string } = {}) {
    await this.get()
      .locator('.ds-table-row', { hasText: dataSourceName })
      .locator('button:has-text("Sync Metadata")')
      .click();
  }
}
