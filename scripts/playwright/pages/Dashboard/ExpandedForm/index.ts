// playwright-dev-page.ts
import { expect, Locator } from "@playwright/test";
import BasePage from "../../Base";
import { DashboardPage } from "..";

export class ExpandedFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewTableButton = this.dashboard.get().locator(".nc-add-new-table");
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-expanded-form`);
  }

  async fillField({
    columnTitle,
    value,
  }: {
    columnTitle: string;
    value: string;
  }) {
    const field = this.get().locator(
      `[pw-data="nc-expand-col-${columnTitle}"]`
    );
    await field.locator("input").fill(value);
  }

  async save() {
    await this.get().locator('button:has-text("Save Row")').click();
    await this.get().press("Escape");
    await this.get().waitFor({ state: "hidden" });
    await this.toastWait({ message: `updated successfully.` });
    await this.get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
  }
}

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
