// playwright-dev-page.ts
import {  Locator, expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { CellPageObject } from './Cell';
import { ColumnPageObject } from './Column';

export class GridPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly dashboardPage: DashboardPage;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;

  constructor(dashboardPage: DashboardPage) {
    super(dashboardPage.rootPage);
    this.dashboard = dashboardPage;
    this.addNewTableButton = dashboardPage.get().locator('.nc-add-new-table');
    this.column = new ColumnPageObject(this);
    this.cell = new CellPageObject(this);
  }

  get() {
    return this.dashboard.get().locator('[pw-data="nc-grid-wrapper"]');
  }

  row(index: number) {
    return this.get().locator(`tr[data-pw="grid-row-${index}"]`);
  }

  async addNewRow({index = 0, title}: {index?: number, title?: string} = {}) {
    const rowCount = await this.get().locator('.nc-grid-row').count();
    await this.get().locator('.nc-grid-add-new-cell').click();
    if(rowCount + 1 !== await this.get().locator('.nc-grid-row').count()) {
      await this.get().locator('.nc-grid-add-new-cell').click();
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
    await this.get().locator(`td[data-pw="cell-Title-${index}"]`).waitFor({state: 'visible'});
    expect(await this.get().locator(`td[data-pw="cell-Title-${index}"]`).count()).toBe(1);
  }

  async verifyRowDoesNotExist({index}: {index: number}) {
    await this.get().locator(`td[data-pw="cell-Title-${index}"]`).waitFor({state: 'hidden'});
    return expect(await this.get().locator(`td[data-pw="cell-Title-${index}"]`).count()).toBe(0);
  }

  async deleteRow(index: number) {
    await this.get().locator(`td[data-pw="cell-Title-${index}"]`).click({
      button: 'right'
    });

    // Click text=Delete Row
    await this.rootPage.locator('text=Delete Row').click();
    // todo: improve selector
    await this.rootPage.locator('span.ant-dropdown-menu-title-content > nc-project-menu-item').waitFor({state: 'hidden'});
    await this.rootPage.waitForTimeout(300);
  }

  async openExpandedRow({index}:{index: number}) {
    await this.row(index).locator(`td[pw-data="cell-id-${index}"]`).hover();
    await this.row(index).locator(`div[pw-data="nc-expand-${index}"]`).click();
  }

  async selectAll() {
    await this.get().locator('[pw-data="nc-check-all"]').hover();
    await this.get().locator('[pw-data="nc-check-all"]').locator('input[type="checkbox"]').click();
  }

  async deleteAll() {
    await this.selectAll();
    await this.get().locator('[pw-data="nc-check-all"]').locator('input[type="checkbox"]').click({
      button: 'right'
    });
    await this.rootPage.locator('text=Delete Selected Rows').click();
  }
}