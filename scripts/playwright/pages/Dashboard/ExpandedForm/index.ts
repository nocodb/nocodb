// playwright-dev-page.ts
import { Locator } from "@playwright/test";
import BasePage from "../../Base";
import { DashboardPage } from "..";

export class ExpandedFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewTableButton = this.dashboard.get().locator(".nc-add-new-table");
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-expanded-form`);
  }

  async fillField({
    columnTitle,
    value,
    type = "text",
  }: {
    columnTitle: string;
    value: string;
    type?: string;
  }) {
    const field = this.get().locator(
      `[pw-data="nc-expand-col-${columnTitle}"]`
    );
    await field.hover();
    switch (type) {
      case "text":
        await field.locator("input").fill(value);
        break;
      case "belongsTo":
        await field.locator(".nc-action-icon").click();
        await this.dashboard.linkRecord.select(value);
        break;
      case "hasMany":
      case "manyToMany":
        await field.locator(`[data-cy="nc-child-list-button-link-to"]`).click();
        await this.dashboard.linkRecord.select(value);
        break;
    }
  }

  async save() {
    await this.get().locator('button:has-text("Save Row")').click();
    await this.get().press("Escape");
    await this.get().waitFor({ state: "hidden" });
    await this.toastWait({ message: `updated successfully.` });
    await this.rootPage
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
  }
}
