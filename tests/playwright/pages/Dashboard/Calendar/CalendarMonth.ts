import BasePage from '../../Base';
import { CalendarPage } from './index';

export class CalendarMonthPage extends BasePage {
  readonly parent: CalendarPage;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-month-view');
  }

  getRecordContainer() {
    return this.get().getByTestId('nc-calendar-month-record-container');
  }

  async dragAndDrop({ record, to }: { record: string; to: { rowIndex: number; columnIndex: number } }) {
    const recordContainer = this.getRecordContainer();
    const recordCard = recordContainer.getByTestId(`nc-calendar-month-record-${record}`);
    const toDay = this.get()
      .getByTestId('nc-calendar-month-week')
      .nth(to.rowIndex)
      .getByTestId('nc-calendar-month-day')
      .nth(to.columnIndex);
    const cord = await toDay.boundingBox();

    await recordCard.hover();
    await this.rootPage.mouse.down();

    await this.rootPage.waitForTimeout(500);

    await this.rootPage.mouse.move(cord.x + cord.width, cord.y + cord.height, { steps: 10 });
    await this.rootPage.mouse.up();
  }

  async selectDate({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) {
    const week = this.get().getByTestId('nc-calendar-month-week');

    const day = week.nth(rowIndex).getByTestId('nc-calendar-month-day').nth(columnIndex);
    await day.click({
      force: true,
      position: {
        x: 0,
        y: 1,
      },
    });
  }
}
