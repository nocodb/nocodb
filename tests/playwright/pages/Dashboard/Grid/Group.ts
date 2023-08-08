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
    const query = '.nc-group';
    for (const n in indexMap) {
      query.concat(`:nth-child(${n}) `);
    }
    return this.rootPage.locator(query);
  }

  async verifyGroupCount({ count }: { count: number }) {
    expect(await this.get({ indexMap: [1, 1] }).count()).toEqual(count);
  }
  async openGroup({ indexMap }: { indexMap: number[] }) {
    let root = this.rootPage.locator('.nc-group');

    for (const n of indexMap) {
      await root.nth(n).click();
      root = root.nth(n).locator('.nc-group');
    }
  }
}
