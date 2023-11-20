import BasePage from '../../Base';
import { GridPage } from './index';
import { RowPageObject } from './Row';
import { expect } from '@playwright/test';
import { DashboardPage } from '../index';
import { CellPageObject } from '../common/Cell';

export class GroupPageObject extends BasePage {
  readonly grid: GridPage;
  readonly rows: RowPageObject;
  readonly cell: CellPageObject;
  readonly dashboard: DashboardPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.rows = new RowPageObject(grid);
    this.cell = new CellPageObject(grid);
    this.dashboard = grid.dashboard;
  }

  get({ indexMap }: { indexMap: Array<number> }) {
    let query = '';
    for (const n of indexMap) {
      query = query + `.nc-group:nth-child(${n + 1}) `;
    }
    return this.rootPage.locator(query);
  }

  async openGroup({ indexMap }: { indexMap: number[] }) {
    let root = this.rootPage.locator('.nc-group');
    for (const n of indexMap) {
      await root.nth(n).click();
      root = root.nth(n).locator('.nc-group');
    }
  }

  async verifyGroupHeader({ indexMap, count, title }: { indexMap: number[]; count: number; title: string }) {
    const groupWrapper = this.get({ indexMap });
    await expect(groupWrapper.locator('.nc-group-column-title')).toHaveText(title);
    await expect(groupWrapper.locator('.nc-group-row-count')).toHaveText(`(Count: ${count})`);
  }

  async verifyPagination({ indexMap, count }: { indexMap: number[]; count: number }) {
    const groupWrapper = this.get({ indexMap });
    await expect(groupWrapper.locator('.nc-grid-row-count').first()).toHaveText(`${count} record`);
  }

  async verifyGroup({ indexMap, value }: { indexMap: number[]; value: string }) {
    let query = '';
    for (const n of indexMap) {
      query += ` .nc-group:nth-child(${n + 1})`;
    }
    const groupWrapper = this.get({ indexMap });
    await expect(groupWrapper.locator('.nc-group-value').first()).toHaveText(value);
    await expect(this.rootPage.locator(`${query} .nc-group-value`).first()).toHaveText(value);
  }

  async verifyRow({ indexMap, rowIndex }: { indexMap: number[]; rowIndex: number }) {
    const gridWrapper = this.get({ indexMap });
    await gridWrapper.locator(`td[data-testid="cell-Title-${rowIndex}"]`).waitFor({ state: 'visible' });
    await expect(gridWrapper.locator(`td[data-testid="cell-Title-${rowIndex}"]`)).toHaveCount(1);
  }

  async validateFirstRow({
    indexMap,
    rowIndex,
    columnHeader,
    value,
  }: {
    indexMap: number[];
    rowIndex: number;
    columnHeader: string;
    value: string;
  }) {
    const gridWrapper = this.get({ indexMap });
    await gridWrapper
      .locator(`.nc-group-table .nc-grid-row:nth-child(${rowIndex + 1}) [data-title="${columnHeader}"]`)
      .scrollIntoViewIfNeeded();
    await expect(
      gridWrapper.locator(`.nc-group-table .nc-grid-row:nth-child(${rowIndex + 1}) [data-title="${columnHeader}"]`)
    ).toHaveText(value);
  }

  async addNewRow({
    indexMap,
    index = 0,
    columnHeader = 'Title',
    value,
  }: {
    indexMap: number[];
    index?: number;
    columnHeader?: string;
    value?: string;
  }) {
    const rowValue = value ?? `Row ${index}`;
    // wait for render to complete before count
    if (index !== 0) await this.get({ indexMap }).locator('.nc-grid-row').nth(0).waitFor({ state: 'attached' });

    const addNewRowBtn = this.get({ indexMap }).locator('.nc-grid-add-new-row');
    await addNewRowBtn.scrollIntoViewIfNeeded();
    await (await addNewRowBtn.elementHandle()).waitForElementState('stable');

    await this.rootPage.waitForTimeout(200);
    await this.rootPage.waitForLoadState('networkidle');
    await this.rootPage.waitForTimeout(200);
    await this.rootPage.waitForLoadState('domcontentloaded');

    await this.get({ indexMap }).locator('.nc-grid-add-new-row').click();

    const rowCount = index + 1;
    await expect(this.get({ indexMap }).locator('.nc-grid-row')).toHaveCount(rowCount);

    await this._fillRow({ indexMap, index, columnHeader, value: rowValue });

    await this.dashboard.waitForLoaderToDisappear();
  }

  async deleteRow({ title, indexMap, rowIndex = 0 }: { title: string; indexMap: number[]; rowIndex?: number }) {
    await this.get({ indexMap }).getByTestId(`cell-${title}-${rowIndex}`).click({
      button: 'right',
    });

    // Click text=Delete Row
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete record")').click();
    // todo: improve selector
    await this.rootPage
      .locator('span.ant-dropdown-menu-title-content > nc-base-menu-item')
      .waitFor({ state: 'hidden' });

    await this.rootPage.waitForTimeout(300);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async editRow({
    indexMap,
    rowIndex = 0,
    columnHeader = 'Title',
    value,
  }: {
    indexMap: number[];
    rowIndex?: number;
    columnHeader?: string;
    value: string;
  }) {
    await this._fillRow({ indexMap, index: rowIndex, columnHeader, value });

    await this.dashboard.waitForLoaderToDisappear();
  }

  private async _fillRow({
    indexMap,
    index,
    columnHeader,
    value,
  }: {
    indexMap: number[];
    index: number;
    columnHeader: string;
    value: string;
  }) {
    const cell = this.cell.get({ indexMap, index, columnHeader });
    await cell.waitFor({ state: 'visible' });
    await this.cell.dblclick({
      index,
      columnHeader,
    });
    await cell.locator('input').fill(value);
  }
}
