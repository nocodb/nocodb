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

  get({index, columnHeader}: {index: number, columnHeader: string}): Locator {
    return this.grid.get().locator(`td[data-pw="cell-${columnHeader}-${index}"]`);
  }

  async click({index, columnHeader}: {index: number, columnHeader: string}) {
    return this.get({index, columnHeader}).click();
  }

  async dblclick({index, columnHeader}: {index: number, columnHeader: string}) {
    return this.get({index, columnHeader}).dblclick();
  }

  async verify({index, columnHeader, value}: {index: number, columnHeader: string, value: string | string[]}) {
    const _verify = async (text) => {
      await expect.poll(async () => {
        const innerTexts = await this.get({index, columnHeader}).allInnerTexts()
        return typeof(innerTexts) === "string" ? [innerTexts]: innerTexts;
      }).toContain(text);
    }

    if(Array.isArray(value)) {
      for(const text of value) {
        await _verify(text);
      }
    } else {
      await _verify(value);
    }
  }
}