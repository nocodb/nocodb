import BasePage from "../../../../Base";
import { DashboardPage } from "../../../index";
import { expect } from "@playwright/test";

export class LinkRecord extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  async verify(cardTitle?: string[]) {
    await this.dashboard.get().locator(".nc-modal-link-record").waitFor();
    let linkRecord = await this.get();

    // DOM element validation
    //    title: Link Record
    //    button: Add new record
    //    icon: reload
    expect(await this.get().locator(`.ant-modal-title`).innerText()).toBe(
      `Link record`
    );
    expect(
      await linkRecord.locator(`button:has-text("Add new record")`).isVisible()
    ).toBeTruthy();
    expect(await linkRecord.locator(`.nc-reload`).isVisible()).toBeTruthy();
    // placeholder: Filter query
    expect(
      await linkRecord.locator(`[placeholder="Filter query"]`).isVisible()
    ).toBeTruthy();

    {
      let childList = linkRecord.locator(`.ant-card`);
      const childCards = await childList.count();
      await expect(childCards).toEqual(cardTitle.length);
      for (let i = 0; i < cardTitle.length; i++) {
        expect(await childList.nth(i).textContent()).toContain(cardTitle[i]);
      }
    }
  }

  async close() {
    await this.get().locator(`.ant-modal-close-x`).click();
    await this.get().waitFor({ state: "hidden" });
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-link-record`);
  }
}
