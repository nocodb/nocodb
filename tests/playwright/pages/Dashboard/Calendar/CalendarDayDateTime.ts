import BasePage from '../../Base';
import { CalendarPage } from './index';

export class CalendarDayDateTimePage extends BasePage {
  readonly parent: CalendarPage;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-day-view');
  }

  getRecordContainer() {
    return this.get().getByTestId('nc-calendar-day-record-container');
  }

  async dragAndDrop({ record, hourIndex }: { record: string; hourIndex: number }) {
    const recordContainer = this.getRecordContainer();
    const recordCard = recordContainer.getByTestId(`nc-calendar-day-record-${record}`);
    const toDay = this.get().getByTestId('nc-calendar-day-hour').nth(hourIndex);

    await this.get().getByTestId('nc-calendar-day-hour').nth(0).scrollIntoViewIfNeeded();

    const cord = await toDay.boundingBox();

    await recordCard.scrollIntoViewIfNeeded();
    await recordCard.hover();
    await this.rootPage.mouse.down();
    await this.rootPage.mouse.move(cord.x + cord.width / 2, cord.y + cord.height / 2, {
      steps: 10,
    });

    // Bit Flaky
    await this.rootPage.waitForTimeout(500);

    await this.rootPage.mouse.up();
  }

  async selectHour({ hourIndex }: { hourIndex: number }) {
    const hour = this.get().getByTestId('nc-calendar-day-hour').nth(hourIndex);
    await hour.click({
      force: true,
      position: {
        x: 0,
        y: 1,
      },
    });
  }
}
