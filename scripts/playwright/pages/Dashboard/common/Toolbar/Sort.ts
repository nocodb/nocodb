import BasePage from "../../../Base";
import { ToolbarPage } from "./index";

export class ToolbarSortPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="nc-sorts-menu"]`);
  }

  async addSort({
    columnTitle,
    isAscending,
    isLocallySaved,
  }: {
    columnTitle: string;
    isAscending: boolean;
    isLocallySaved: boolean;
  }) {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator(`button:has-text("Add Sort Option")`).click();

    await this.rootPage.locator(".nc-sort-field-select").last().click();
    await this.rootPage
      .locator("div.ant-select-dropdown.nc-dropdown-toolbar-field-list")
      .locator(`div[label="${columnTitle}"]`)
      .last()
      .click();

    await this.rootPage.locator(".nc-sort-dir-select").last().click();
    const selectSortDirection =  this.rootPage
      .locator(".nc-dropdown-sort-dir")
      .locator(".ant-select-item")
      .nth(isAscending ? 0 : 1)
      .click();
    
    if(isLocallySaved) {
      await this.waitForResponse({
        uiAction: selectSortDirection,
        httpMethodsToMatch: ["GET"],
        requestUrlPathToMatch:  `${isAscending ? "asc" : "desc"}`,
      })
    } else {
      await this.waitForResponse({
        uiAction: selectSortDirection,
        httpMethodsToMatch: ["POST", "PATCH"],
        requestUrlPathToMatch: "/sorts",
      })
    }


    // close sort menu
    await this.toolbar.clickSort();
    await this.toolbar.parent.waitLoading();
  }

  async resetSort() {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator(".nc-sort-item-remove-btn").click();

    // close sort menu
    await this.toolbar.clickSort();
  }

  click({ title }: { title: string }) {
    return this.get()
      .locator(`[pw-data="nc-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();
  }
}
