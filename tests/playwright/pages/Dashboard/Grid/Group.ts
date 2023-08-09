import BasePage from '../../Base';
import { GridPage } from './index';
import { RowPageObject } from './Row';
import { expect } from '@playwright/test';

export class GroupPageObject extends BasePage {
  readonly grid: GridPage;
  readonly rows: RowPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
  }

  get({ indexMap }: { indexMap: Array<number> }) {
    let query = '';
    for (const [n] of indexMap.entries()) {
      query += `.nc-group:nth-child(${n + 1}) `;
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
    await expect(groupWrapper.locator('.nc-group-column-title').first()).toHaveText(title);
    await expect(groupWrapper.locator('.nc-group-row-count').first()).toHaveText(`(Count: ${count})`);
  }

  async verifyPagination({ indexMap, count }: { indexMap: number[]; count: number }) {
    const groupWrapper = this.get({ indexMap });
    await expect(groupWrapper.locator('.nc-grid-row-count').first()).toHaveText(`${count} record`);
  }

  async verifyGroup({ indexMap, value }: { indexMap: number[]; value: string }) {
    let query = '';
    for (const [n] of indexMap.entries()) {
      query += ` .nc-group:nth-child(${n + 1})`;
    }
    await expect(this.rootPage.locator(`${query} .nc-group-value`).first()).toHaveText(value);
  }

  async verifyRow({ indexMap, rowIndex }: { indexMap: number[]; rowIndex: number }) {
    const gridWrapper = this.get({ indexMap });
    await gridWrapper.locator(`td[data-testid="cell-Title-${rowIndex}"]`).waitFor({ state: 'visible' });
    await expect(gridWrapper.locator(`td[data-testid="cell-Title-${rowIndex}"]`)).toHaveCount(1);
  }
}
