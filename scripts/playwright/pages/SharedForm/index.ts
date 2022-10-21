// playwright-dev-page.ts
import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../Base";
import { CellPageObject } from "../Dashboard/common/Cell";

export class SharedFormPage extends BasePage {
  readonly cell: CellPageObject;

  constructor(rootPage: Page) {
    super(rootPage);
    this.cell = new CellPageObject(this);
  }

  get() {
    return this.rootPage.locator("html");
  }

  async submit() {
    await this.get().locator('[pw-data="shared-form-submit-button"]').click();
  }
}
