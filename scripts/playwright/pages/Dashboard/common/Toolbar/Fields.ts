import BasePage from "../../../Base";
import { ToolbarPage } from "./index";

export class ToolbarFieldsPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="nc-fields-menu"]`);
  }

  async toggle({ title }: { title: string }) {
    await this.toolbar.clickFields();
    await this.get()
      .locator(`[pw-data="nc-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
    await this.toolbar.clickFields();
  }

  async click({ title }: { title: string }) {
    await this.get()
      .locator(`[pw-data="nc-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
    await this.toolbar.parent.waitLoading();
  }

  async hideAll() {
    await this.toolbar.clickFields();
    await this.get().locator(`button:has-text("Hide all")`).click();
    await this.toolbar.clickFields();
  }

  async showAll() {
    await this.toolbar.clickFields();
    await this.get().locator(`button:has-text("Show all")`).click();
    await this.toolbar.clickFields();
  }

  async toggleShowSystemFields() {
    await this.toolbar.clickFields();
    await this.get().locator(`.nc-fields-show-system-fields`).click();
    await this.toolbar.clickFields();
  }
}
