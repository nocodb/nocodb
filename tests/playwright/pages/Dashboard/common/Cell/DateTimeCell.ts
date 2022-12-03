import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class DateTimeCellPageObject extends BasePage {
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

  async selectDateTime({
    // date in format `YYYY-MM-DD`
    // time in format 'HH:mm'
    dateTime,
  }: {
    dateTime: string;
  }) {
    await this.rootPage.locator(`td[title="${dateTime}"]`).click();
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
