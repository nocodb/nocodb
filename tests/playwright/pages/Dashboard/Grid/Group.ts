import BasePage from '../../Base';
import { GridPage } from './index';
import { RowPageObject } from './Row';

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

  async getGroupCount() {
    return this.get().count();
  }

  async clickGroup(index: number) {
    await this.get().nth(index).click();
  }
}
