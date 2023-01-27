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
    await this.rootPage.locator('.nc-grid-add-new-cell').click();

    await this.cell.dblclick({
      index,
      columnHeader,
    });
  }

  async save() {
    await this.rootPage.locator('button:has-text("Ok")').click();
  }

  async selectDate({
    // date formats in `YYYY-MM-DD`
    date,
  }: {
    date: string;
  }) {
    // title date format needs to be YYYY-MM-DD
    const [year, month, day] = date.split('-');

    // configure year
    await this.rootPage.locator('.ant-picker-year-btn').click();
    await this.rootPage.locator(`td[title="${year}"]`).click();

    // configure month
    await this.rootPage.locator('.ant-picker-month-btn').click();
    await this.rootPage.locator(`td[title="${year}-${month}"]`).click();

    // configure day
    await this.rootPage.locator(`td[title="${year}-${month}-${day}"]`).click();
  }

  async selectTime({
    // hour: 0 - 23
    // minute: 0 - 59
    // second: 0 - 59
    hour,
    minute,
    second,
  }: {
    hour: number;
    minute: number;
    second?: number | null;
  }) {
    await this.rootPage
      .locator(`.ant-picker-time-panel-column:nth-child(1) > .ant-picker-time-panel-cell:nth-child(${hour + 1})`)
      .click();
    await this.rootPage
      .locator(`.ant-picker-time-panel-column:nth-child(2) > .ant-picker-time-panel-cell:nth-child(${minute + 1})`)
      .click();
    if (second != null) {
      await this.rootPage
        .locator(`.ant-picker-time-panel-column:nth-child(3) > .ant-picker-time-panel-cell:nth-child(${second + 1})`)
        .click();
    }
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
