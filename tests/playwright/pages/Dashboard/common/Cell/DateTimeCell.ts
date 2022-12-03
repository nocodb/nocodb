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

  async selectDate({
    // date in format `YYYY-MM-DD`
    date,
  }: {
    date: string;
  }) {
    await this.rootPage.locator(`td[title="${date}"]`).click();
  }

  async selectTime({
    // hour: 0 - 23
    // minute: 0 - 59
    // second: 0 - 59
    hour,
    minute,
    second,
  }: {
    hour: string;
    minute: string;
    second?: string;
  }) {
    await this.rootPage
      .locator(`.ant-picker-time-panel-column:nth-child(1) > ant-picker-time-panel-cell:nth-child(${hour})`)
      .click();
    await this.rootPage
      .locator(`.ant-picker-time-panel-column:nth-child(2) > ant-picker-time-panel-cell:nth-child(${minute})`)
      .click();
    if (second != null) {
      await this.rootPage
        .locator(`.ant-picker-time-panel-column:nth-child(3) > ant-picker-time-panel-cell:nth-child(${second})`)
        .click();
    }
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
