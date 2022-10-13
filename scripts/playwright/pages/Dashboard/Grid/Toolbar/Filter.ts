import BasePage from "../../../Base";
import { ToolbarPage } from ".";

export class ToolbarFilterPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="grid-filter-menu"]`);
  }

  async addNew({
    columnTitle,
    opType,
    value,
  }: {
    columnTitle: string;
    opType: string;
    value: string;
  }) {
    await this.toolbar.clickFilter();

    await this.get().locator(`button:has-text("Add Filter")`).first().click();

    await this.rootPage.locator(".nc-filter-field-select").last().click();
    await this.rootPage
      .locator("div.ant-select-dropdown.nc-dropdown-toolbar-field-list")
      .locator(`div[label="${columnTitle}"][aria-selected="false"]`)
      .click();

    await this.rootPage.locator(".nc-filter-operation-select").last().click();
    // await this.rootPage.locator('.nc-dropdown-filter-comp-op').locator(`.ant-select-item:has-text("${opType}")`).scrollIntoViewIfNeeded();
    await this.rootPage
      .locator(".nc-dropdown-filter-comp-op")
      .locator(`.ant-select-item:has-text("${opType}")`)
      .click();

    await this.rootPage.locator(".nc-filter-value-select").last().fill(value);

    await this.toolbar.clickFilter();
  }

  click({ title }: { title: string }) {
    return this.get()
      .locator(`[pw-data="grid-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
  }

  async resetFilter() {
    await this.toolbar.clickFilter();
    await this.get().locator(".nc-filter-item-remove-btn").click();
    await this.toolbar.clickFilter();
  }
}
