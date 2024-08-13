import { SettingsPage } from '.';
import BasePage from '../../Base';
import { SettingsErdPage } from './Erd';
import { MetaDataPage } from '../ProjectView/Metadata';

export class DataSourcesPage extends BasePage {
  private readonly settings: SettingsPage;
  readonly erd: SettingsErdPage;
  readonly metaData: MetaDataPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
    this.erd = new SettingsErdPage(this);
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

  async openMetaSync({ rowIndex }: { rowIndex: number }) {
    // 0th offset for header
    const row = this.get()
      .locator('.ds-table-row')
      .nth(rowIndex + 1);
    await row.click();
    await this.get().getByTestId('nc-meta-sync-tab').click();
  }
}
