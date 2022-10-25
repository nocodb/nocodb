// playwright-dev-page.ts
import { expect, Locator } from "@playwright/test";
import BasePage from "../../Base";
import { DashboardPage } from "..";

export class ImportAirtablePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly importButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.importButton = dashboard.get().locator(".nc-btn-airtable-import");
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-airtable-import`);
  }

  async import({ key, baseId }: { key: string; baseId: string }) {
    await this.get().locator(`.nc-input-api-key >> input`).fill(key);
    await this.get().locator(`.nc-input-shared-base`).fill(baseId);
    await this.importButton.click();

    await this.get().locator(`button:has-text("Go to Dashboard")`).waitFor();
    await this.get().locator(`button:has-text("Go to Dashboard")`).click();
  }
}
