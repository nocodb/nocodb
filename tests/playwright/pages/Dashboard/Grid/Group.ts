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

  get() {
    return this.rootPage.locator('.nc-group');
  }

  async getGroup(index: number) {
    return this.get().nth(index);
  }

  async verifyGroupCount({ count }: { count: number }) {
    expect(await this.get().count()).toEqual(count);
  }

  async clickGroup(index: number) {
    await this.get().nth(index).click();
  }

  async verifyGroup({ index, title, count }: { index: number; title: string; count: string }) {
    const group = await this.getGroup(index);
    expect(
      await group.locator('.nc-group-column-title').innerText({
        timeout: 2000,
      })
    ).toEqual(title);

    expect(
      await group.locator('.nc-group-row-count').innerText({
        timeout: 2000,
      })
    ).toEqual(count);
  }
}
