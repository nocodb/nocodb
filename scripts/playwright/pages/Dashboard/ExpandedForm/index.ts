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
  }: {
    columnTitle: string;
    value: string;
  }) {
    const field = this.get().locator(
      `[pw-data="nc-expand-col-${columnTitle}"]`
    );
    await field.locator("input").fill(value);
  }

  async save() {
    await this.get().locator('button:has-text("Save Row")').click();
    await this.get().press("Escape");
    await this.get().waitFor({ state: "hidden" });
    await this.toastWait({ message: `updated successfully.` });
    await this.get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
  }
}
