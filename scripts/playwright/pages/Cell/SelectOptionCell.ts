import { expect } from "@playwright/test";
import { CellPageObject } from ".";

export class SelectOptionCellPageObject {
  readonly cell: CellPageObject;
  constructor(cell: CellPageObject) {
    this.cell = cell;
  }

  async select({index, columnHeader, option, multiSelect}: {index: number, columnHeader: string, option: string, multiSelect?: boolean}) {
    await this.cell.get({index, columnHeader}).click();
    const count = await this.cell.page.locator('.rc-virtual-list-holder .ant-select-item-option-content', {hasText: option}).count();

    for(let i = 0; i < count; i++) {
      if(await this.cell.page.locator('.rc-virtual-list-holder .ant-select-item-option-content', {hasText: option}).nth(i).isVisible()) {
        await this.cell.page.locator('.rc-virtual-list-holder .ant-select-item-option-content', {hasText: option}).nth(i).click();
      }
    }

    if(multiSelect) await this.cell.get({index, columnHeader}).click();

    await this.cell.page.locator(`.nc-dropdown-single-select-cell`).nth(index).waitFor({state: 'hidden'});
    // todo: Remove this wait. Should be solved by adding pw-data-attribute with cell info to the a-select-option of the cell
    // await this.cell.page.waitForTimeout(200);
  }

  async clear({index, columnHeader, multiSelect}: {index: number, columnHeader: string, multiSelect?: boolean}) {
    if(multiSelect){
      await this.cell.get({index, columnHeader}).click();
      await this.cell.get({index, columnHeader}).click();

      const optionCount = await this.cell.get({index, columnHeader}).locator('.ant-tag').count();

      for(let i = 0; i < optionCount; i++) {
        await this.cell.get({index, columnHeader}).locator('.ant-tag > .ant-tag-close-icon').first().click();
        // wait till number of options is less than before
        await this.cell.get({index, columnHeader}).locator('.ant-tag').nth(optionCount - i - 1).waitFor({state: 'hidden'});
      }
      return
    }

    await this.cell.get({index, columnHeader}).click();
    await this.cell.page.locator('.ant-select-single > .ant-select-clear').click();
    await this.cell.get({index, columnHeader}).click();
    await this.cell.page.locator(`.nc-dropdown-single-select-cell`).waitFor({state: 'hidden'});
  }

  async verify({index, columnHeader, option, multiSelect}: {index: number, columnHeader: string, option: string, multiSelect?: boolean}) {
    if(multiSelect) {
      return expect(
        this.cell.get({index, columnHeader})).toContainText(option, {useInnerText: true});
    }
    return expect(this.cell.get({index, columnHeader}).locator('.ant-select-selection-item > .ant-tag')).toHaveText(option, {useInnerText: true});
  }

  async verifyNoOptionsSelected({index, columnHeader}: {index: number, columnHeader: string}) {
    return expect(this.cell.get({index, columnHeader}).locator('.ant-select-selection-item > .ant-tag')).toBeHidden();
  }

  async verifyOptions({index, columnHeader, options}: {index: number, columnHeader: string, options: string[]}) {
    await this.cell.get({index, columnHeader}).click();

    let counter = 0;
    for (const option of options) {
      const optionInDom = await this.cell.page.locator(`div.ant-select-item-option`).nth(counter)
        .evaluate((node) =>  (node as HTMLElement).innerText)
      expect(optionInDom).toBe(option);
      counter++;
    }
    await this.cell.click({index, columnHeader});
    await this.cell.page.locator(`.nc-dropdown-single-select-cell`).nth(index).waitFor({state: 'hidden'});
  }
}