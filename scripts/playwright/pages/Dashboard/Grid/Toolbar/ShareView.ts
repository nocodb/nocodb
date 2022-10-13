import BasePage from "../../../Base";
import { ToolbarPage } from ".";

export class ToolbarShareViewPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-modal-share-view`);
  }

  async enablePassword() {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-password"`)
      .click();
  }

  async disablePassword() {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-password"`)
      .click();
  }

  async toggleDownload() {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-csv-download"]`)
      .click();
  }

  async getShareLink() {
    return this.get()
      .locator(`[data-pw="nc-modal-share-view__link"]`)
      .innerText();
  }
}
