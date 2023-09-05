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
    await this.rootPage.waitForTimeout(100);
    await this.cell.dblclick({
      index,
      columnHeader,
    });
  }

  async save() {
    await this.rootPage.locator('button:has-text("Ok"):visible').click();
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
    await this.rootPage.locator('.ant-picker-year-btn:visible').waitFor();
    await this.rootPage.locator('.ant-picker-year-btn:visible').click();
    await this.rootPage.locator(`td[title="${year}"]`).click();

    // configure month
    await this.rootPage.locator('.ant-picker-month-btn:visible').click();
    await this.rootPage.locator(`td[title="${year}-${month}"]`).click();

    // configure day
    await this.rootPage.locator(`td[title="${year}-${month}-${day}"]:visible`).click();
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
      .locator(
        `.ant-picker-time-panel-column:nth-child(1) > .ant-picker-time-panel-cell:nth-child(${hour + 1}):visible`
      )
      .click();
    await this.rootPage
      .locator(
        `.ant-picker-time-panel-column:nth-child(2) > .ant-picker-time-panel-cell:nth-child(${minute + 1}):visible`
      )
      .click();
    if (second != null) {
      await this.rootPage
        .locator(
          `.ant-picker-time-panel-column:nth-child(3) > .ant-picker-time-panel-cell:nth-child(${second + 1}):visible`
        )
        .click();
    }
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }

  async setDateTime({ index, columnHeader, dateTime }: { index: number; columnHeader: string; dateTime: string }) {
    const [date, time] = dateTime.split(' ');
    const [hour, minute, _second] = time.split(':');
    await this.open({ index, columnHeader });
    await this.selectDate({ date });
    await this.selectTime({ hour: +hour, minute: +minute });
    await this.save();
  }
}
