import BasePage from "../../../../Base";
import { DashboardPage } from "../../../index";
import { expect } from "@playwright/test";

export class ChildList extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  async verify({
    cardTitle,
    linkField,
  }: {
    cardTitle: string[];
    linkField: string;
  }) {
    // DOM element validation
    //    title: Child list
    //    button: Link to 'City'
    //    icon: reload
    expect(await this.get().locator(`.ant-modal-title`).innerText()).toBe(
      `Child list`
    );
    expect(
      await this.get()
        .locator(`button:has-text("Link to '${linkField}'")`)
        .isVisible()
    ).toBeTruthy();
    expect(
      await this.get().locator(`[data-cy="nc-child-list-reload"]`).isVisible()
    ).toBeTruthy();

    // child list body validation (card count, card title)
    const cardCount = cardTitle.length;
    await this.get().locator(".ant-modal-content").waitFor();
    {
      let childList = this.get().locator(`.ant-card`);
      const childCards = await childList.count();
      await expect(childCards).toEqual(cardCount);
      for (let i = 0; i < cardCount; i++) {
        expect(await childList.nth(i).textContent()).toContain(cardTitle[i]);
        // icon: unlink
        // icon: delete
        expect(
          await childList
            .nth(i)
            .locator(`[data-cy="nc-child-list-icon-unlink"]`)
            .isVisible()
        ).toBeTruthy();
        expect(
          await childList
            .nth(i)
            .locator(`[data-cy="nc-child-list-icon-delete"]`)
            .isVisible()
        ).toBeTruthy();
      }
    }
  }

  async close() {
    await this.get().locator(`.ant-modal-close-x`).click();
    await this.get().waitFor({ state: "hidden" });
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-child-list`);
  }
}
