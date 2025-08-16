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

  async moveToDate({
    date,
    action,
    jumpTo,
    postSelectViewMode,
  }: {
    date: string;
    action: 'prev' | 'next';
    /**
     * Takes a while to move to date if we click one day at a time
     * So we can jump to nearest date and then move to the date
     * @Note - Select proper jumpTo so that action will work properly
     */
    jumpTo?: {
      day: number;
      month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
      year: number;
    };
    postSelectViewMode?: 'day' | 'week' | 'month' | 'year';
  }) {
    if (jumpTo) {
      await this.parent.toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

      // Select year
      let activeYear = +(await this.parent.toolbar.getActiveDate());

      while (activeYear !== jumpTo.year) {
        if (activeYear < jumpTo.year) {
          await this.clickNext();
        } else {
          await this.clickPrev();
        }

        activeYear = +(await this.parent.toolbar.getActiveDate());
      }

      const day = String(jumpTo.day).padStart(2, '0');

      const dateLocator = this.parent.calendarYear
        .get()
        .locator(`[data-testid="nc-calendar-date"][data-date="${day} ${jumpTo.month} ${jumpTo.year}"]`)
        .first();

      await dateLocator.scrollIntoViewIfNeeded();
      await dateLocator.waitFor();

      await dateLocator.click();

      if (postSelectViewMode) {
        await this.parent.toolbar.calendarViewMode.changeCalendarView({ title: postSelectViewMode });
      }
    }

    let activeDate = await this.parent.toolbar.getActiveDate();

    while (activeDate !== date) {
      if (action === 'prev') {
        await this.clickPrev();
      } else {
        await this.clickNext();
      }

      activeDate = await this.parent.toolbar.getActiveDate();
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
