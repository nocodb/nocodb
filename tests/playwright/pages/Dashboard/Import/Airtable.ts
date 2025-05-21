import { Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';

export class ImportAirtablePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly importButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.importButton = dashboard.get().locator('.nc-btn-airtable-import');
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-airtable-import`);
  }

  async import({ key, sourceId }: { key: string; sourceId: string }) {
    // kludge: failing in headless mode
    // additional time to allow the modal to render completely
    await this.rootPage.waitForTimeout(1000);

    await this.get().locator(`.nc-input-api-key >> input`).fill(key);
    await this.get().locator(`.nc-input-shared-base`).fill(sourceId);
    await this.importButton.click();

    await this.get().locator(`button:has-text("Go to base")`).waitFor();
    await this.get().locator(`button:has-text("Go to base")`).click();
  }
}
