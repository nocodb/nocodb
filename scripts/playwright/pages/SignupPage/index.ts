// playwright-dev-page.ts
import { expect, Page } from "@playwright/test";
import BasePage from "../Base";

export class SignupPage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0'
    return `nc_test_${parallelId}_${email}`;
  }

  goto() {
    return this.rootPage.goto("/#/signup/");
  }

  get() {
    return this.rootPage.locator("html");
  }

  async signUp({ email, password, withoutPrefix }: { email: string; password: string, withoutPrefix?: boolean }) {
    if(!withoutPrefix) email = this.prefixEmail(email);
    
    const signUp = this.rootPage;
    await signUp.locator('button:has-text("SIGN UP")').waitFor();

    await signUp
      .locator(`input[placeholder="Enter your work email"]`)
      .fill(email);
    await signUp
      .locator(`input[placeholder="Enter your password"]`)
      .fill(password);
    await signUp.locator(`button:has-text("SIGN UP")`).click();
  }
}
