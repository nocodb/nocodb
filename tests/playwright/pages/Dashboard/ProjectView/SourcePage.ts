import BasePage from '../../Base';
import { DataSourcePage } from './DataSourcePage';

export class SourcePage extends BasePage {
  readonly dataSources: DataSourcePage;

  constructor(dataSource: DataSourcePage) {
    super(dataSource.rootPage);
    this.dataSources = dataSource;
  }

  get() {
    return this.dataSources.get();
  }

  getDsDetailsModal() {
    return this.dataSources.getDsDetailsModal();
  }

  async openEditWindow({ sourceName }: { sourceName: string }) {
    await this.get().locator('.ds-table-row', { hasText: sourceName }).click();
    await this.getDsDetailsModal().getByTestId('nc-connection-tab').click();

    await this.getDsDetailsModal().locator('.nc-general-overlay').first().waitFor({ state: 'hidden' });
  }

  async updateSchemaReadOnly({ sourceName, readOnly }: { sourceName: string; readOnly: boolean }) {
    await this.openEditWindow({ sourceName });
    const switchBtn = this.getDsDetailsModal().getByTestId('nc-allow-meta-write');
    await switchBtn.scrollIntoViewIfNeeded();

    if ((await switchBtn.getAttribute('aria-checked')) !== (!readOnly).toString()) {
      await switchBtn.click();
    }
    await this.saveConnection();
  }

  async updateDataReadOnly({ sourceName, readOnly = true }: { sourceName: string; readOnly?: boolean }) {
    await this.openEditWindow({ sourceName });
    const switchBtn = this.getDsDetailsModal().getByTestId('nc-allow-data-write');
    await switchBtn.scrollIntoViewIfNeeded();

    if ((await switchBtn.getAttribute('aria-checked')) !== (!readOnly).toString()) {
      await switchBtn.click();
    }
    await this.saveConnection();
  }

  async saveConnection() {
    await this.getDsDetailsModal().locator('.nc-extdb-btn-test-connection').click();
    await this.getDsDetailsModal().locator('.nc-extdb-btn-submit:enabled').click();
  }
}
