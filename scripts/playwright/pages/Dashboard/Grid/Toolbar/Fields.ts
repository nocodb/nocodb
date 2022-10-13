import BasePage from "../../../Base";
import { ToolbarPage } from ".";

export class ToolbarFieldsPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="grid-fields-menu"]`);
  }

  async toggle({ title }: { title: string }) {
    await this.toolbar.clickFields();
    await this.get()
      .locator(`[pw-data="grid-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
    await this.toolbar.clickFields();
  }
}
