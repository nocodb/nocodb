import { Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { TopbarSharePage } from './Share';
import { CalendarPage } from './index';

export class CalendarTopbarPage extends BasePage {
  readonly parent: CalendarPage;
  readonly share: TopbarSharePage;

  readonly today_btn: Locator;
  readonly prev_btn: Locator;
  readonly next_btn: Locator;

  readonly side_bar_btn: Locator;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;

    this.next_btn = this.get().getByTestId('nc-calendar-next-btn');
    this.prev_btn = this.get().getByTestId('nc-calendar-prev-btn');
    this.today_btn = this.get().getByTestId('nc-calendar-today-btn');

    this.side_bar_btn = this.get().getByTestId('nc-calendar-side-bar-btn');
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-topbar');
  }

  async clickPrev() {
    await this.prev_btn.click();
  }
  async clickNext() {
    await this.next_btn.click();
  }
  async clickToday() {
    await this.today_btn.click();
  }

  async toggleSideBar() {
    await this.side_bar_btn.click();
    await this.rootPage.waitForTimeout(500);
  }
}
