import BasePage from "../../../Base";
import { ToolbarPage } from ".";

export class ToolbarSortPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[pw-data="grid-sorts-menu"]`);
  }

  async addNew({
    columnTitle,
    isAscending,
  }: {
    columnTitle: string;
    isAscending: boolean;
  }) {

    await this.get().locator(`button:has-text("Add Sort Option")`).click();

    await this.rootPage.locator('.nc-sort-field-select').click();
    await this.rootPage.locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list').locator(`div[label="${columnTitle}"]`).click();

    await this.rootPage.locator('.nc-sort-dir-select').click();
    await this.rootPage.locator('.nc-dropdown-sort-dir').locator('.ant-select-item').nth(isAscending ? 0 : 1).click();
  }

  click({ title}: { title: string }) {
    return this.get().locator(`[pw-data="grid-fields-menu-${title}"]`).locator('input[type="checkbox"]').click();
  }
}