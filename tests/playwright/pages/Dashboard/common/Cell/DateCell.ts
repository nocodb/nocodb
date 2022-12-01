import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class DateCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async open({ index, columnHeader }: { index: number; columnHeader: string }) {
    await this.cell.dblclick({
      index,
      columnHeader,
    });
  }

  async selectDate({
    // date in format `YYYY-MM-DD`
    date,
  }: {
    date: string;
  }) {
    await this.rootPage.locator(`td[title="${date}"]`).click();
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
