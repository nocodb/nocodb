import { Page } from '@playwright/test';
import BasePage from '../Base';

export class LoginPage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  async goto() {
    return this.rootPage.goto('/#/signin');
  }

  get() {
    return this.rootPage.locator('html');
  }

  async fillEmail({ email, withoutPrefix }: { email: string; withoutPrefix?: boolean }) {
    if (!withoutPrefix) email = this.prefixEmail(email);

    await this.get().locator(`[data-testid="nc-form-signin__email"]`).waitFor();
    await this.get().locator(`[data-testid="nc-form-signin__email"]`).fill(email);
  }

  async fillPassword(password: string) {
    await this.get().locator(`[data-testid="nc-form-signin__password"]`).fill(password);
  }

  async submit() {
    await this.get().locator(`[data-testid="nc-form-signin__submit"]`).click();
    await this.rootPage.locator('.nc-treeview-container').waitFor({ timeout: 10000 });
  }

  async signIn({
    email,
    password,
    withoutPrefix,
    skipReload = false,
  }: {
    email: string;
    password: string;
    withoutPrefix?: boolean;
    skipReload?: boolean;
  }) {
    if (!skipReload) await this.goto();

    // todo: Login page is sometimes not loaded. Probably because of lazy loading
    await this.rootPage.waitForTimeout(1500);
    await this.fillEmail({ email, withoutPrefix });
    await this.fillPassword(password);
    await this.submit();
  }
}
