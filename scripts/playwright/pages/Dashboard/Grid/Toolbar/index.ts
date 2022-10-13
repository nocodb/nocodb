import BasePage from "../../../Base";
import { GridPage } from "..";
import { ToolbarFieldsPage } from "./Fields";
import { ToolbarSortPage } from "./Sort";
import { ToolbarFilterPage } from "./Filter";
import { ToolbarShareViewPage } from "./ShareView";

export class ToolbarPage extends BasePage {
  readonly grid: GridPage;
  readonly fields: ToolbarFieldsPage;
  readonly sort: ToolbarSortPage;
  readonly filter: ToolbarFilterPage;
  readonly shareView: ToolbarShareViewPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.fields = new ToolbarFieldsPage(this);
    this.sort = new ToolbarSortPage(this);
    this.filter = new ToolbarFilterPage(this);
    this.shareView = new ToolbarShareViewPage(this);
  }

  get() {
    return this.rootPage.locator(`.nc-table-toolbar`);
  }

  async clickFields() {
    const menuOpen = await this.fields.get().isVisible();

    await this.get().locator(`button:has-text("Fields")`).click();

    // Wait for the menu to close
    if(menuOpen) await this.fields.get().waitFor({ state: "hidden" });
  }

  async clickSort() {
    const menuOpen = await this.sort.get().isVisible();

    await this.get().locator(`button:has-text("Sort")`).click();

    // Wait for the menu to close
    if(menuOpen) await this.sort.get().waitFor({ state: "hidden" });
  }

  async clickFilter() {
    const menuOpen = await this.filter.get().isVisible();

    await this.get().locator(`button:has-text("Filter")`).click();

    // Wait for the menu to close
    if(menuOpen) await this.filter.get().waitFor({ state: "hidden" });
  }

  async clickShareView() {
    const menuOpen = await this.shareView.get().isVisible();

    await this.get().locator(`button:has-text("Share View")`).click();

    // Wait for the menu to close
    if(menuOpen) await this.shareView.get().waitFor({ state: "hidden" });
  }

  async clickAddNewRow() {
    await this.get().locator(`.nc-toolbar-btn.nc-add-new-row-btn`).click();
  }
}
