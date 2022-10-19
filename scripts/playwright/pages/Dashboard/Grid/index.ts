// playwright-dev-page.ts
import { Locator, expect } from "@playwright/test";
import { DashboardPage } from "..";
import BasePage from "../../Base";
import { CellPageObject } from "./Cell";
import { ColumnPageObject } from "./Column";
import { ToolbarPage } from "../common/Toolbar";

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
    return await this.get().locator(".nc-grid-row").count();
  }

  async verifyRowCount({ count }: { count: number }) {
    return expect(await this.get().locator(".nc-grid-row").count()).toBe(count);
  }

  async addNewRow({
    index = 0,
    columnHeader = "Title",
    value,
  }: { index?: number; columnHeader?: string; value?: string } = {}) {
    const rowCount = await this.get().locator(".nc-grid-row").count();
    await this.get().locator(".nc-grid-add-new-cell").click();

    expect
      .poll(async () => await this.get().locator(".nc-grid-row").count())
      .toBe(rowCount + 1);

    await this.editRow({ index, columnHeader, value });
  }

  async editRow({
    index = 0,
    columnHeader = "Title",
    value,
  }: { index?: number; columnHeader?: string; value?: string } = {}) {
    const cell = this.cell.get({ index, columnHeader });
    await this.cell.dblclick({
      index,
      columnHeader,
    });

    await cell.locator("input").fill(value ?? `Row ${index}`);

    await this.cell.grid
      .get()
      .locator(`[data-title="${columnHeader}"]`)
      .locator(`span[title="${columnHeader}"]`)
      .click();

    await this.waitForResponseJson({
      responseSelector: (resJson) => resJson?.[columnHeader] === value,
    });
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
    await (
      await this.rootPage.locator(".ant-drawer-body").elementHandle()
    )?.waitForElementState("stable");
  }

  async selectAll() {
    await this.get().locator('[pw-data="nc-check-all"]').hover();

    await this.get()
      .locator('[pw-data="nc-check-all"]')
      .locator('input[type="checkbox"]')
      .check({
        force: true,
      });

    const rowCount = await this.rowCount();
    for (let i = 0; i < rowCount; i++) {
      await expect
        .poll(
          async () =>
            await this.row(i)
              .locator(`[pw-data="cell-id-${i}"]`)
              .locator("span.ant-checkbox-checked")
              .count()
        )
        .toBe(1);
    }
    await this.rootPage.waitForTimeout(300);
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

    await this.waitForResponseJson({
      responseSelector: (resJson) => resJson?.pageInfo,
    });

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

  async verifyEditDisabled({
    columnHeader = "Title",
  }: { columnHeader?: string } = {}) {
    // double click to toggle to edit mode
    const cell = this.cell.get({ index: 0, columnHeader: columnHeader });
    await this.cell.dblclick({
      index: 0,
      columnHeader: columnHeader,
    });
    expect(await cell.locator("input")).not.toBeVisible();

    // right click menu
    await this.get().locator(`td[data-pw="cell-${columnHeader}-0"]`).click({
      button: "right",
    });
    expect(
      await this.rootPage.locator("text=Insert New Row")
    ).not.toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: "City List" }).hover();
    expect(
      await this.cell
        .get({ index: 0, columnHeader: "City List" })
        .locator(".nc-action-icon.nc-plus")
    ).not.toBeVisible();

    // expand row
    await this.cell.get({ index: 0, columnHeader: "City List" }).hover();
    expect(
      await this.cell
        .get({ index: 0, columnHeader: "City List" })
        .locator(".nc-action-icon >> nth=0")
    ).not.toBeVisible();
  }

  async verifyEditEnabled({
    columnHeader = "Title",
  }: { columnHeader?: string } = {}) {
    // double click to toggle to edit mode
    const cell = this.cell.get({ index: 0, columnHeader: columnHeader });
    await this.cell.dblclick({
      index: 0,
      columnHeader: columnHeader,
    });
    expect(await cell.locator("input")).toBeVisible();

    // right click menu
    await this.get().locator(`td[data-pw="cell-${columnHeader}-0"]`).click({
      button: "right",
    });
    expect(await this.rootPage.locator("text=Insert New Row")).toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: "City List" }).hover();
    expect(
      await this.cell
        .get({ index: 0, columnHeader: "City List" })
        .locator(".nc-action-icon.nc-plus")
    ).toBeVisible();

    // expand row
    await this.cell.get({ index: 0, columnHeader: "City List" }).hover();
    expect(
      await this.cell
        .get({ index: 0, columnHeader: "City List" })
        .locator(".nc-action-icon.nc-arrow-expand")
    ).toBeVisible();
  }
}
