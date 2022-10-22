// playwright-dev-page.ts
import { expect, Page } from "@playwright/test";
import BasePage from "../Base";

export class LoginPage extends BasePage {

  constructor(rootPage: Page) {
    super(rootPage);
  }

  goto() {
    return this.rootPage.goto('/#/signin');
  }

  get() {
    return this.rootPage.locator("html");
  }

  async fillEmail(email: string) {
    await this.get().locator(`[pw-data="nc-form-signin__email"]`).fill(email);
  }

  async fillPassword(password: string) {
    await this.get().locator(`[pw-data="nc-form-signin__password"]`).fill(password);
  }

  async submit() {
    await this.get().locator(`[pw-data="nc-form-signin__submit"]`).click();

    await expect(this.rootPage).toHaveURL('http://localhost:3000/#/');
  }

}
