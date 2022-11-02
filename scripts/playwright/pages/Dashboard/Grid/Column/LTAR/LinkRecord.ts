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
    await this.dashboard.get().locator('.nc-modal-link-record').waitFor();
    const linkRecord = await this.get();

    // DOM element validation
    //    title: Link Record
    //    button: Add new record
    //    icon: reload
    await expect(this.get().locator(`.ant-modal-title`)).toHaveText(`Link record`);
    await expect(await linkRecord.locator(`button:has-text("Add new record")`).isVisible()).toBeTruthy();
    await expect(await linkRecord.locator(`.nc-reload`).isVisible()).toBeTruthy();
    // placeholder: Filter query
    await expect(await linkRecord.locator(`[placeholder="Filter query"]`).isVisible()).toBeTruthy();

    {
      const childList = linkRecord.locator(`.ant-card`);
      const childCards = await childList.count();
      await expect(childCards).toEqual(cardTitle.length);
      for (let i = 0; i < cardTitle.length; i++) {
        await expect(await childList.nth(i).textContent()).toContain(cardTitle[i]);
      }
    }
  }

  async select(cardTitle: string) {
    await this.get().locator(`.ant-card:has-text("${cardTitle}"):visible`).click();
  }

  async close() {
    await this.get().locator(`.ant-modal-close-x`).click();
    await this.get().waitFor({ state: 'hidden' });
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-link-record`);
  }
}
