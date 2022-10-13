import BasePage from "../../../Base";
import { GridPage } from "..";
import { ToolbarFieldsPage } from "./Fields";
import { ToolbarSortPage } from "./Sort";
import { ToolbarFilterPage } from "./Filter";

export class ToolbarPage extends BasePage {
  readonly grid: GridPage;
  readonly fields: ToolbarFieldsPage;
  readonly sort: ToolbarSortPage;
  readonly filter: ToolbarFilterPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.fields = new ToolbarFieldsPage(this);
    this.sort = new ToolbarSortPage(this);
    this.filter = new ToolbarFilterPage(this);
  }

  get() {
    return this.rootPage.locator(`.nc-table-toolbar`);
  }

  async clickFields() {
    await this.get().locator(`button:has-text("Fields")`).click();
  }

  async clickSort() {
    await this.get().locator(`button:has-text("Sort")`).click();
  }

  async clickFilter() {
    await this.get().locator(`button:has-text("Filter")`).click();
  }

}