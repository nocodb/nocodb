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

  row(index: number) {
    return this.page.locator(`tr[data-pw="grid-row-${index}"]`);
  }

  async addNewRow({index = 0, title}: {index?: number, title?: string} = {}) {
    const rowCount = await this.page.locator('.nc-grid-row').count();
    await this.page.locator('.nc-grid-add-new-cell').click();
    if(rowCount + 1 !== await this.page.locator('.nc-grid-row').count()) {
      await this.page.locator('.nc-grid-add-new-cell').click();
    }
    
    const cell = this.cell.get({index, columnHeader: 'Title'});
    await this.cell.dblclick({
      index,
      columnHeader: 'Title'
    });

    
    await cell.locator('input').fill(title ?? `Row ${index}`);
    await cell.locator('input').press('Enter');
  }

  async verifyRow({index}: {index: number}) {
    await this.page.locator(`td[data-pw="cell-Title-${index}"]`).waitFor({state: 'visible'});
    expect(await this.page.locator(`td[data-pw="cell-Title-${index}"]`).count()).toBe(1);
  }

  async verifyRowDoesNotExist({index}: {index: number}) {
    await this.page.locator(`td[data-pw="cell-Title-${index}"]`).waitFor({state: 'hidden'});
    return expect(await this.page.locator(`td[data-pw="cell-Title-${index}"]`).count()).toBe(0);
  }

  async deleteRow(index: number) {
    await this.page.locator(`td[data-pw="cell-Title-${index}"]`).click({
      button: 'right'
    });

    // Click text=Delete Row
    await this.page.locator('text=Delete Row').click();
    await this.page.locator('span.ant-dropdown-menu-title-content > nc-project-menu-item').waitFor({state: 'hidden'});
    await this.page.waitForTimeout(300);
  }

  async openExpandedRow({index}:{index: number}) {
    await this.row(index).locator(`td[pw-data="cell-id-${index}"]`).hover();
    await this.row(index).locator(`div[pw-data="nc-expand-${index}"]`).click();
  }

  async selectAll() {
    await this.page.locator('[pw-data="nc-check-all"]').hover();
    await this.page.locator('[pw-data="nc-check-all"]').locator('input[type="checkbox"]').click();
  }

  async deleteAll() {
    await this.selectAll();
    await this.page.locator('[pw-data="nc-check-all"]').locator('input[type="checkbox"]').click({
      button: 'right'
    });
    await this.page.locator('text=Delete Selected Rows').click();
  }
}