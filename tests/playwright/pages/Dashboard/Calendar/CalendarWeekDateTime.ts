import BasePage from '../../Base';
import { CalendarPage } from './index';

export class CalendarWeekDateTimePage extends BasePage {
  readonly parent: CalendarPage;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-week-view');
  }

  getRecordContainer() {
    return this.get().getByTestId('nc-calendar-week-record-container');
  }

  async dragAndDrop({ record, hourIndex }: { record: string; hourIndex: number }) {
    const recordContainer = this.getRecordContainer();
    const recordCard = recordContainer.getByTestId(`nc-calendar-week-record-${record}`);
    const toDay = this.get().getByTestId('nc-calendar-day-hour').nth(hourIndex);
    const cord = await toDay.boundingBox();

    await recordCard.hover();
    await this.rootPage.mouse.down({ button: 'right' });
    await this.rootPage.mouse.move(cord.x + cord.width / 2, cord.y + cord.height / 2);
    await this.rootPage.mouse.up();
  }

  async selectHour({ hourIndex, dayIndex }: { dayIndex: number; hourIndex: number }) {
    const day = this.get().getByTestId('nc-calendar-week-day').nth(dayIndex);

    const hour = day.getByTestId('nc-calendar-week-hour').nth(hourIndex);
    await hour.click({
      force: true,
      position: {
        x: 0,
        y: 1,
      },
    });
  }
}
