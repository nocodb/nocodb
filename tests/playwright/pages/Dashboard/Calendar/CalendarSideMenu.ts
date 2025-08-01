import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { CalendarPage } from './index';

export class CalendarSideMenuPage extends BasePage {
  readonly parent: CalendarPage;

  readonly new_record_btn: Locator;

  readonly prev_btn: Locator;
  readonly next_btn: Locator;
  readonly searchToggleBtn: Locator;
  readonly monthPrev_btn: Locator;
  readonly monthNext_btn: Locator;

  constructor(parent: CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;

    this.new_record_btn = this.get().getByTestId('nc-calendar-side-menu-new-btn');

    this.next_btn = this.parent.toolbar.get().getByTestId('nc-calendar-next-btn');
    this.prev_btn = this.parent.toolbar.get().getByTestId('nc-calendar-prev-btn');

    this.monthPrev_btn = this.get().locator('button.nc-button').first();
    this.monthNext_btn = this.get().locator('button.nc-button').nth(1);

    this.searchToggleBtn = this.get().getByTestId('nc-calendar-sidebar-search-btn');
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-side-menu');
  }

  async updateFilter({ filter }: { filter: string }) {
    const filterInput = this.get().getByTestId('nc-calendar-sidebar-filter');
    await filterInput.click();
    await this.rootPage.locator('.ant-dropdown').locator(`.nc-menu-item:has-text("${filter}")`).click();
  }

  async searchRecord({ query }: { query: string }) {
    if ((await this.rootPage.locator('.nc-calendar-sidebar-search-active').count()) === 0) {
      await this.searchToggleBtn.click();
    }
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
    console.log(await this.parent.toolbar.getActiveDate());

    // takes a while to move to date if we click one day at a time
    // so we will move to the month first and then select the date
    const dateStr = new Date(date);
    const options = { month: 'long', year: 'numeric' };
    console.log(dateStr.toLocaleDateString('en-US', options));

    let dateHeaderStr = await this.get().locator('.nc-date-week-header').textContent();

    while (dateHeaderStr !== dateStr.toLocaleDateString('en-US', options)) {
      if (action === 'prev') {
        console.log(await this.monthPrev_btn.count());
        await this.monthPrev_btn.click();
      } else {
        console.log(await this.monthNext_btn.count());
        await this.monthNext_btn.click();
      }
      dateHeaderStr = await this.get().locator('.nc-date-week-header').textContent();
    }

    // once the month is narrowed down, click on either the first or last date depending on how we intended to navigate
    // we can click on date directly. but continuing with the existing logic as it verifies prev & next date movement as well
    if (action === 'prev') {
      await this.get().getByTestId('nc-calendar-date').last().click();
    } else {
      await this.get().getByTestId('nc-calendar-date').first().click();
    }

    while ((await this.parent.toolbar.getActiveDate()) !== date) {
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
