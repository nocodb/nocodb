import BasePage from '../../Base';
import { CalendarPage } from './index';
import { expect } from '@playwright/test';

export class CalendarDayDatePage extends BasePage {
  readonly parent: CalendarPage;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-day-view');
  }

  async verifyRecord(data: { records: string[] }) {
    const records = await this.get().getByTestId('nc-calendar-day-record-card');

    await expect(records).toHaveCount(data.records.length);

    for (let i = 0; i < data.records.length; i++) {
      await expect(records.nth(i)).toContainText(data.records[i]);
    }
  }
}
