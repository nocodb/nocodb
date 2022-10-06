import { Page, Locator } from "@playwright/test";
import { SelectOptionCellPageObject } from "./SelectOptionCell";

export class CellPageObject {
  readonly page: Page;
  readonly selectOption: SelectOptionCellPageObject;

  constructor(page: Page) {
    this.page = page;
    this.selectOption = new SelectOptionCellPageObject(this);
  }

  get({index, columnHeader}: {index: number, columnHeader: string}): Locator {
    return this.page.locator(`tr.nc-grid-row:nth-child(${index + 1}) > [data-title="${columnHeader}"]`);
  }

  async click({index, columnHeader}: {index: number, columnHeader: string}) {
    return this.get({index, columnHeader}).click();
  }
}