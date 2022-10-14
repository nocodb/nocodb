// playwright-dev-page.ts
import { Locator, expect } from "@playwright/test";
import { DashboardPage } from "..";
import BasePage from "../../Base";
import { CellPageObject } from "./Cell";
import { ColumnPageObject } from "./Column";
import { ToolbarPage } from "./Toolbar";

export class GridPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly dashboardPage: DashboardPage;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;
  readonly toolbar: ToolbarPage;

  constructor(dashboardPage: DashboardPage) {
    super(dashboardPage.rootPage);
    this.dashboard = dashboardPage;
    this.addNewTableButton = dashboardPage.get().locator(".nc-add-new-table");
    this.column = new ColumnPageObject(this);
    this.cell = new CellPageObject(this);
    this.toolbar = new ToolbarPage(this);
  }

  get() {
    return this.dashboard.get().locator('[pw-data="nc-grid-wrapper"]');
  }

  row(index: number) {
    return this.get().locator(`tr[data-pw="grid-row-${index}"]`);
  }

  async rowCount() {
    await this.get().locator(".nc-grid-row").count();
  }

  async verifyRowCount({ count }: { count: number }) {
    return expect(await this.get().locator(".nc-grid-row").count()).toBe(count);
  }

  async addNewRow({
    index = 0,
    title = "Title",
    value,
  }: { index?: number; title?: string; value?: string } = {}) {
    const rowCount = await this.get().locator(".nc-grid-row").count();
    await this.get().locator(".nc-grid-add-new-cell").click();

    expect
      .poll(async () => await this.get().locator(".nc-grid-row").count())
      .toBe(rowCount + 1);

    const cell = this.cell.get({ index, columnHeader: title });
    await this.cell.dblclick({
      index,
      columnHeader: title,
    });

    if (value) {
      await cell.locator("input").fill(value);
    } else {
      await cell.locator("input").fill(title ?? `Row ${index}`);
    }
    await this.cell.grid
      .get()
      .locator(`[data-title="${title}"]`)
      .locator(`span[title="${title}"]`)
      .click();
  }

  async verifyRow({ index }: { index: number }) {
    await this.get()
      .locator(`td[data-pw="cell-Title-${index}"]`)
      .waitFor({ state: "visible" });
    expect(
      await this.get().locator(`td[data-pw="cell-Title-${index}"]`).count()
    ).toBe(1);
  }

  async verifyRowDoesNotExist({ index }: { index: number }) {
    await this.get()
      .locator(`td[data-pw="cell-Title-${index}"]`)
      .waitFor({ state: "hidden" });
    return expect(
      await this.get().locator(`td[data-pw="cell-Title-${index}"]`).count()
    ).toBe(0);
  }

  async deleteRow(index: number) {
    await this.get().locator(`td[data-pw="cell-Title-${index}"]`).click({
      button: "right",
    });

    // Click text=Delete Row
    await this.rootPage.locator("text=Delete Row").click();
    // todo: improve selector
    await this.rootPage
      .locator("span.ant-dropdown-menu-title-content > nc-project-menu-item")
      .waitFor({ state: "hidden" });
    await this.rootPage.waitForTimeout(300);
  }

  async addRowRightClickMenu(index: number) {
    const rowCount = await this.get().locator(".nc-grid-row").count();
    await this.get().locator(`td[data-pw="cell-Title-${index}"]`).click({
      button: "right",
    });
    // Click text=Insert New Row
    await this.rootPage.locator("text=Insert New Row").click();
    expect(await this.get().locator(".nc-grid-row").count()).toBe(rowCount + 1);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.row(index).locator(`td[pw-data="cell-id-${index}"]`).hover();
    await this.row(index).locator(`div[pw-data="nc-expand-${index}"]`).click();
  }

  async selectAll() {
    await this.get().locator('[pw-data="nc-check-all"]').hover();

    // fix me! without this, elements are getting de-checked after select-all
    await this.rootPage.waitForTimeout(1000);

    await this.get()
      .locator('[pw-data="nc-check-all"]')
      .locator('input[type="checkbox"]')
      .click();
  }

  async deleteAll() {
    await this.selectAll();
    await this.get().locator('[pw-data="nc-check-all"]').nth(0).click({
      button: "right",
    });
    await this.rootPage.locator("text=Delete Selected Rows").click();
  }

  private async pagination({ page }: { page: string }) {
    await this.get().locator(`.nc-pagination`).waitFor();

    if (page === "<")
      return this.get().locator(".nc-pagination > .ant-pagination-prev");
    if (page === ">")
      return this.get().locator(".nc-pagination > .ant-pagination-next");

    return this.get().locator(
      `.nc-pagination > .ant-pagination-item.ant-pagination-item-${page}`
    );
  }

  async clickPagination({ page }: { page: string }) {
    (await this.pagination({ page })).click();
    await this.waitLoading();
  }

  async verifyActivePage({ page }: { page: string }) {
    expect(await this.pagination({ page })).toHaveClass(
      /ant-pagination-item-active/
    );
  }

  async waitLoading() {
    await this.dashboard
      .get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
  }
}
