import BasePage from '../../../../Base';
import { DashboardPage } from '../../../index';
import { expect } from '@playwright/test';

export class LinkRecord extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  async verify(cardTitle?: string[]) {
    await this.dashboard.get().locator('.nc-modal-link-record').last().waitFor();
    const linkRecord = this.get();

    // DOM element validation
    //    title: Link Record
    //    button: Add new record
    //    icon: reload
    expect(await linkRecord.locator(`button:has-text("New record")`).isVisible()).toBeTruthy();
    // placeholder: Filter query
    expect(await linkRecord.locator('.nc-excluded-search').isVisible()).toBeTruthy();

    {
      const childList = linkRecord.getByTestId(`nc-excluded-list-item`);
      await expect.poll(() => linkRecord.getByTestId(`nc-excluded-list-item`).count()).toBe(cardTitle.length);
      for (let i = 0; i < cardTitle.length; i++) {
        await childList.nth(i).locator('.nc-display-value').scrollIntoViewIfNeeded();
        await childList.nth(i).locator('.nc-display-value').waitFor({ state: 'visible' });
        expect(await childList.nth(i).locator('.nc-display-value').textContent()).toContain(cardTitle[i]);
      }
    }
  }

  async select(cardTitle: string) {
    await this.rootPage.waitForTimeout(100);
    await this.get().locator(`.ant-card:has-text("${cardTitle}"):visible`).click();
    await this.close();
  }

  async close() {
    await this.get().locator('.nc-close-btn').last().click();
    await this.get().last().waitFor({ state: 'hidden' });
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-link-record`);
  }
}
