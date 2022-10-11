import { Page, Locator,expect } from "@playwright/test";
import { SelectOptionCellPageObject } from "./SelectOptionCell";

export class CellPageObject {
  readonly page: Page;
  readonly selectOption: SelectOptionCellPageObject;

  constructor(page: Page) {
    this.page = page;
    this.selectOption = new SelectOptionCellPageObject(this);
  }

  get({index, columnHeader}: {index: number, columnHeader: string}): Locator {
    return this.page.locator(`td[data-pw=cell-${columnHeader}-${index}]`);
  }

  async click({index, columnHeader}: {index: number, columnHeader: string}) {
    return this.get({index, columnHeader}).click();
  }

  async dblclick({index, columnHeader}: {index: number, columnHeader: string}) {
    return this.get({index, columnHeader}).dblclick();
  }

  async verify({index, columnHeader, value}: {index: number, columnHeader: string, value: string}) {
    return expect(await this.get({index, columnHeader}).innerText()).toBe(value);
  }
}