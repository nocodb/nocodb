// playwright-dev-page.ts
import {  Locator, Page, expect } from '@playwright/test';
import { CellPageObject } from './Cell';
import { ColumnPageObject } from './Column';

export class GridPage {
  readonly page: Page;
  readonly addNewTableButton: Locator;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;

  constructor(page: Page) {
    this.page = page;
    this.addNewTableButton = page.locator('.nc-add-new-table');
    this.column = new ColumnPageObject(page);
    this.cell = new CellPageObject(page);
  }

  async addNewRow({index = 0, title}: {index?: number, title?: string} = {}) {
    await this.page.locator('.nc-grid-add-new-cell').click();

      // Double click td >> nth=1
    await this.page.locator('td[data-title="Title"]').nth(index).dblclick();

    
    // Fill text=1Add new row >> input >> nth=1
    await this.page.locator(`div[data-pw="cell-Title-${index}"] >> input`).fill(title ?? `Row ${index}`);
    
    await this.page.locator('span[title="Title"]').click();
    await this.page.locator('.nc-grid-wrapper').click();
  }

  async verifyRowDoesNotExist({index}: {index: number}) {
    return expect(await this.page.locator(`td[data-pw="cell-Title-${index}"]`)).toBeHidden();
  }

  async deleteRow(index: number) {
    await this.page.locator(`td[data-pw="cell-Title-${index}"]`).click({
      button: 'right'
    });

    // Click text=Delete Row
    await this.page.locator('text=Delete Row').click();
  }

}