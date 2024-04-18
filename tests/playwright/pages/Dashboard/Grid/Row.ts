import BasePage from '../../Base';
import { GridPage } from './index';

export class RowPageObject extends BasePage {
  readonly grid: GridPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
  }

  get() {
    return this.rootPage.locator('tr.nc-grid-row');
  }

  getRecord(index: number) {
    return this.get().nth(index);
  }

  // style="height: 32px;"
  async getRecordHeight(index: number) {
    const record = this.getRecord(index);
    const style = await record.getAttribute('style');
    return style.split(':')[1].split(';')[0].trim();
  }
}
