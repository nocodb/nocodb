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
    const query = ' .nc-group';
    for (const [n, key] of indexMap.entries()) {
      query.concat(`:nth-child(${n}) `);
      if (indexMap[key + 1]) {
        query.concat(` .nc-group`);
      }
    }
    console.log(query);
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
}
