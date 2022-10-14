import { expect, Locator } from "@playwright/test";
import { GridPage } from "..";
import BasePage from "../../../Base";
import { SelectOptionCellPageObject } from "./SelectOptionCell";

export class CellPageObject extends BasePage {
  readonly grid: GridPage;
  readonly selectOption: SelectOptionCellPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.selectOption = new SelectOptionCellPageObject(this);
  }

  get({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }): Locator {
    return this.grid
      .get()
      .locator(`td[data-pw="cell-${columnHeader}-${index}"]`);
  }

  async click({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    return this.get({ index, columnHeader }).click();
  }

  async dblclick({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    return this.get({ index, columnHeader }).dblclick();
  }

  async inCellExpand({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    await this.get({ index, columnHeader }).hover();
    await this.get({ index, columnHeader })
      .locator(".nc-action-icon >> nth=0")
      .click();
  }

  async inCellAdd({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    await this.get({ index, columnHeader }).hover();
    await this.get({ index, columnHeader })
      .locator(".nc-action-icon.nc-plus")
      .click();
  }

  async verify({
    index,
    columnHeader,
    value,
  }: {
    index: number;
    columnHeader: string;
    value: string | string[];
  }) {
    const _verify = async (text) => {
      await expect
        .poll(async () => {
          const innerTexts = await this.get({
            index,
            columnHeader,
          }).allInnerTexts();
          return typeof innerTexts === "string" ? [innerTexts] : innerTexts;
        })
        .toContain(text);
    };

    if (Array.isArray(value)) {
      for (const text of value) {
        await _verify(text);
      }
    } else {
      await _verify(value);
    }
  }

  // verifyVirtualCell
  //  : virtual relational cell- HM, BT, MM
  //  : verify link count & cell value
  //
  async verifyVirtualCell({
    index,
    columnHeader,
    count,
    value,
  }: {
    index: number;
    columnHeader: string;
    count: number;
    value: string[];
  }) {
    // const count = value.length;
    const cell = this.get({ index, columnHeader });
    const chips = cell.locator(".chips > .chip");
    const chipCount = await chips.count();

    // verify chip count & contents
    expect(chipCount).toEqual(count);

    // verify only the elements that are passed in
    for (let i = 0; i < value.length; ++i) {
      expect(await chips.nth(i).textContent()).toBe(value[i]);
    }
  }

  async unlinkVirtualCell({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    const cell = this.get({ index, columnHeader });
    await cell.click();
    await cell.locator(".nc-icon.unlink-icon").click();
  }
}
