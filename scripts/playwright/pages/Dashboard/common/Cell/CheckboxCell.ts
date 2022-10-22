import { expect } from "@playwright/test";
import { CellPageObject } from ".";
import BasePage from "../../../Base";

export class CheckboxCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({index, columnHeader}: {index?: number, columnHeader: string}) {
    return this.cell.get({index, columnHeader});
  }

  async click({ index, columnHeader }: { index?: number, columnHeader: string }) {
    return this.get({index, columnHeader}).locator('.nc-cell').click();
  }

  async isChecked({ index, columnHeader }: { index?: number, columnHeader: string }) {
    return this.get({index, columnHeader}).locator('.nc-cell-hover-show').isVisible();
  }

  async verifyChecked({ index, columnHeader }: { index?: number, columnHeader: string }) {
    expect(await this.get({index, columnHeader}).locator('.nc-cell-hover-show').isVisible()).toBe(false);
  }

  async verifyUnchecked({ index, columnHeader }: { index?: number, columnHeader: string }) {
    expect(await this.get({index, columnHeader}).locator('.nc-cell-hover-show').isVisible()).toBe(true);
  }
}