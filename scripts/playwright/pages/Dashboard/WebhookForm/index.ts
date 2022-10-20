// playwright-dev-page.ts
import { expect, Locator } from "@playwright/test";
import BasePage from "../../Base";
import { DashboardPage } from "..";
// import clipboard from "clipboardy";

export class WebhookFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewButton: Locator;
  readonly saveButton: Locator;
  readonly testButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewButton = this.dashboard.get().locator(".nc-btn-create-webhook");
    this.saveButton = this.get().locator('button:has-text("Save")');
    this.testButton = this.get().locator('button:has-text("Test Webhook")');
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-webhook`);
  }

  async create({
    title,
    event,
    url,
  }: {
    title: string;
    event: string;
    url: string;
  }) {
    await this.addNewButton.click();
    await this.get().waitFor({ state: "visible" });

    await this.configureHeader({
      key: "Content-type",
      value: "application/json",
    });

    await this.configureWebhook({ title, event, url });
  }

  async configureWebhook({
    title,
    event,
    url,
  }: {
    title?: string;
    event?: string;
    url?: string;
  }) {
    if (title) {
      await this.get().locator(`.nc-text-field-hook-title`).fill(title);
    }
    if (event) {
      await this.get().locator(`.nc-text-field-hook-event`).click();
      const modal = this.rootPage.locator(`.nc-dropdown-webhook-event`);
      await modal.locator(`.ant-select-item:has-text("${event}")`).click();
    }
    if (url) {
      await this.get().locator(`.nc-text-field-hook-url-path`).fill(url);
    }
  }

  async addCondition() {
    await this.get().locator(`.nc-check-box-hook-condition`).click();
    const modal = await this.get().locator(`.menu-filter-dropdown`).last();
    await modal.locator(`button:has-text("Add Filter")`).click();
  }

  async deleteCondition() {
    await this.get().locator(`.nc-filter-item-remove-btn`).click();
  }

  async save() {
    await this.saveButton.click();
  }

  async test() {
    await this.testButton.click();
    await this.toastWait({ message: "Webhook tested successfully" });
  }

  async delete({ index }: { index: number }) {
    await this.get().locator(`.nc-hook-delete-icon`).nth(index).click();
    await this.toastWait({ message: "Hook deleted successfully" });
  }

  async close() {
    // type esc key
    await this.get().press("Escape");
  }

  async open({ index }: { index: number }) {
    await this.dashboard.get().locator(`.nc-hook`).nth(index).click();
  }

  async configureHeader({ key, value }: { key: string; value: string }) {
    // hardcode "Content-type: application/json"
    await this.get().locator(`.ant-tabs-tab-btn:has-text("Headers")`).click();

    await this.get().locator(".nc-input-hook-header-key >> input").fill(key);
    const modal = this.rootPage.locator(`.nc-dropdown-webhook-header`);
    await modal.locator(`.ant-select-item:has-text("${key}")`).click();

    await this.get().locator(".nc-input-hook-header-value").type(value);
    await this.get().press("Enter");

    await this.get()
      .locator(".nc-hook-header-tab-checkbox")
      .locator("input.ant-checkbox-input")
      .click();
  }
}
