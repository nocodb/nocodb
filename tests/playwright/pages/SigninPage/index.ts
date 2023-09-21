import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';

export class SigninPage extends BasePage {
  readonly projectsPage: ProjectsPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  async goto() {
    return this.rootPage.goto('/#/signin/');
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({
    email,
    password,
    withoutPrefix,
    expectedError,
  }: {
    email: string;
    password: string;
    withoutPrefix?: boolean;
    expectedError?: string;
  }) {
    if (!withoutPrefix) email = this.prefixEmail(email);

    const signUp = this.get();
    await signUp.locator('button:has-text("SIGN IN")').waitFor();

    await signUp.locator(`input[placeholder="Enter your work email"]`).fill(email);
    await signUp.locator(`input[placeholder="Enter your password"]`).fill(password);
    await signUp.locator(`button:has-text("SIGN IN")`).click();
    if (expectedError) {
      await expect(signUp.getByTestId('nc-signin-error')).toHaveText(expectedError);
    } else {
      await this.projectsPage.waitToBeRendered();
    }
  }
}
