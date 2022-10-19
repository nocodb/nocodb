import BasePage from "../../../Base";
import { ToolbarPage } from "./index";

export class ToolbarFilterPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="nc-filter-menu"]`);
  }

  // Todo: Handle the case of operator does not need a value
  async addNew({
    columnTitle,
    opType,
    value,
    isLocallySaved,
  }: {
    columnTitle: string;
    opType: string;
    value: string;
    isLocallySaved: boolean;
  }) {
    await this.toolbar.clickFilter();

    await this.get().locator(`button:has-text("Add Filter")`).first().click();

    await this.rootPage.locator(".nc-filter-field-select").last().click();
    await this.rootPage
      .locator("div.ant-select-dropdown.nc-dropdown-toolbar-field-list")
      .locator(`div[label="${columnTitle}"][aria-selected="false"]:visible`)
      .click();

    await this.rootPage.locator(".nc-filter-operation-select").last().click();
    await this.rootPage
      .locator(".nc-dropdown-filter-comp-op")
      .locator(`.ant-select-item:has-text("${opType}")`)
      .click();

    const fillFilter = this.rootPage
      .locator(".nc-filter-value-select")
      .last()
      .fill(value);

    if (isLocallySaved) {
      await this.waitForResponse({
        uiAction: fillFilter,
        httpMethodsToMatch: ["GET"],
        requestUrlPathToMatch: `${value.replace(" ", "+")}`,
      });
    } else {
      await this.waitForResponse({
        uiAction: fillFilter,
        httpMethodsToMatch: ["POST", "PATCH"],
        requestUrlPathToMatch: "/filters",
      });
    }
    await this.toolbar.clickFilter();
  }

  click({ title }: { title: string }) {
    return this.get()
      .locator(`[pw-data="nc-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
  }

  async resetFilter() {
    await this.toolbar.clickFilter();
    await this.get().locator(".nc-filter-item-remove-btn").click();
    // await this.waitForResponse({
    //   uiAction: this.get().locator(".nc-filter-item-remove-btn").click(),
    //   httpMethodsToMatch: ["DELETE"],
    //   requestUrlPathToMatch: "/api/v1/db/meta/filters/",
    // });
    await this.toolbar.clickFilter();
  }
}
