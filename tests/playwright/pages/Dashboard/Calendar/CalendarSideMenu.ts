import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { CalendarPage } from './index';

export class CalendarSideMenuPage extends BasePage {
  readonly parent: CalendarPage;

  readonly new_record_btn: Locator;

  readonly prev_btn: Locator;
  readonly next_btn: Locator;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;

    this.new_record_btn = this.get().getByTestId('nc-calendar-side-menu-new-btn');

    this.next_btn = this.get().getByTestId('nc-calendar-next-btn');
    this.prev_btn = this.get().getByTestId('nc-calendar-prev-btn');
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-side-menu');
  }

  async updateFilter({ filter }: { filter: string }) {
    const filterInput = this.get().getByTestId('nc-calendar-sidebar-filter');
    await filterInput.click();
    await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${filter}"`).click();
  }

  async searchRecord({ query }: { query: string }) {
    const searchInput = this.get().getByTestId('nc-calendar-sidebar-search');
    await searchInput.fill(query);
  }

  async clickPrev() {
    await this.prev_btn.click();
  }
  async clickNext() {
    await this.next_btn.click();
  }

  async moveToDate({ date, action }: { date: string; action: 'prev' | 'next' }) {
    while ((await this.parent.toolbar.getActiveDate()) !== date) {
      console.log(await this.parent.toolbar.getActiveDate());
      if (action === 'prev') {
        await this.clickPrev();
      } else {
        await this.clickNext();
      }
    }
  }

  async verifySideBarRecords({ records }: { records: string[] }) {
    let attempts = 0;
    let sideBarRecords: Locator;
    while (attempts++ < 5) {
      const sideBar = this.get().getByTestId('nc-calendar-side-menu-list');
      sideBarRecords = sideBar.getByTestId('nc-sidebar-record-card');

      if ((await sideBarRecords.count()) === records.length) break;
      // wait for records to load
      await this.rootPage.waitForTimeout(200 * attempts);
    }
    await expect(sideBarRecords).toHaveCount(records.length);

    for (let i = 0; i < records.length; i++) {
      await expect(sideBarRecords.nth(i)).toContainText(records[i]);
    }
  }
}
