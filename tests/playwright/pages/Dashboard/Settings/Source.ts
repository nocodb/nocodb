import { SettingsPage } from '.';
import BasePage from '../../Base';

export class SourceSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.rootPage.getByTestId('nc-settings-datasources');
  }

  async openEditWindow({ sourceName }: { sourceName: string }) {
    await this.get().locator('.ds-table-row', { hasText: sourceName }).click();
    await this.get().getByTestId('nc-connection-tab').click();
  }

  async updateSchemaReadOnly({ sourceName, readOnly }: { sourceName: string; readOnly: boolean }) {
    await this.openEditWindow({ sourceName });
    const switchBtn = this.get().getByTestId('nc-allow-meta-write');
    if (switchBtn.getAttribute('checked') !== readOnly.toString()) {
      await switchBtn.click();
    }
    await this.saveConnection();
  }

  async updateDataReadOnly({ sourceName, readOnly = true }: { sourceName: string; readOnly?: boolean }) {
    await this.openEditWindow({ sourceName });
    const switchBtn = this.get().getByTestId('nc-allow-data-write');
    if (switchBtn.getAttribute('checked') !== readOnly.toString()) {
      await switchBtn.click();
    }
    await this.saveConnection();
  }

  async saveConnection() {
    await this.get().locator('.nc-extdb-btn-test-connection').click();
    await this.get().locator('.nc-extdb-btn-submit:enabled').click();
  }
}
