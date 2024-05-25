import { Locator } from '@playwright/test';
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
    skipDate = false,
    index,
    columnHeader,
    locator,
  }: {
    date: string;
    skipDate?: boolean;
    index?: number;
    columnHeader?: string;
    locator?: Locator;
  }) {
    // title date format needs to be YYYY-MM-DD
    const [year, month, day] = date.split('-');
    const dateLocator = locator ? locator : this.get({ index, columnHeader });
    await dateLocator.click();
    await dateLocator.locator('.nc-date-input').click();

    // configure year
    await this.rootPage.locator('.nc-year-picker-btn:visible').waitFor();
    await this.rootPage.locator('.nc-year-picker-btn:visible').click();

    await this.rootPage.locator('.nc-year-picker-btn:visible').waitFor();

    let flag = true;

    while (flag) {
      const firstVisibleYear = await this.rootPage.locator('.nc-year-item').first().textContent();
      const lastVisibleYear = await this.rootPage.locator('.nc-year-item').last().textContent();

      if (+year >= +firstVisibleYear && +year <= +lastVisibleYear) {
        flag = false;
      } else if (+year < +firstVisibleYear) {
        await this.rootPage.locator('.nc-prev-page-btn').click();
      } else if (+year > +lastVisibleYear) {
        await this.rootPage.locator('.nc-next-page-btn').click();
      }
    }

    await this.rootPage.locator(`span[title="${year}"]`).waitFor();
    await this.rootPage.locator(`span[title="${year}"]`).click({ force: true });

    if (skipDate) {
      await this.rootPage.locator(`span[title="${year}-${month}"]`).click();
      return;
    }

    // configure month
    await this.rootPage.locator('.nc-month-picker-btn:visible').click();
    await this.rootPage.locator(`span[title="${year}-${month}"]`).click();

    // configure day
    await this.rootPage.locator(`span[title="${year}-${month}-${day}"]:visible`).click();
  }

  async selectTime({
    // hour: 0 - 23
    // minute: 0 - 59
    // second: 0 - 59

    hour,
    minute,
    second,
    index,
    columnHeader,
    fillValue,
    selectFromPicker = false,
    locator,
  }: {
    hour: number;
    minute: number;
    second?: number | null;
    index?: number;
    columnHeader?: string;
    fillValue: string;
    selectFromPicker?: boolean;
    locator?: Locator;
  }) {
    const timeLocator = locator ? locator : this.get({ index, columnHeader });
    await timeLocator.click();
    const timeInput = timeLocator.locator('.nc-time-input');
    await timeInput.click();

    const dropdown = this.rootPage.locator('.nc-picker-datetime.active');
    await dropdown.waitFor({ state: 'visible' });

    if (!selectFromPicker) {
      await timeInput.fill(fillValue);
      await this.rootPage.keyboard.press('Enter');
      await this.rootPage.keyboard.press('Escape');
    } else {
      await dropdown
        .locator(`[data-testid="time-option-${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}"]`)
        .scrollIntoViewIfNeeded();
      await dropdown
        .locator(`[data-testid="time-option-${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}"]`)
        .click();
    }
    await dropdown.waitFor({ state: 'hidden' });
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }

  async setDateTime({ index, columnHeader, dateTime }: { index: number; columnHeader: string; dateTime: string }) {
    const [date, time] = dateTime.split(' ');
    const [hour, minute, _second] = time.split(':');
    await this.open({ index, columnHeader });
    await this.selectDate({ date, index, columnHeader });
    await this.selectTime({ hour: +hour, minute: +minute, index, columnHeader, fillValue: time });
  }

  clickDateInput = async (locator: Locator) => {
    await locator.locator('.nc-date-input').click();
  };

  clickTimeInput = async (locator: Locator) => {
    await locator.locator('.nc-time-input').click();
  };
}
