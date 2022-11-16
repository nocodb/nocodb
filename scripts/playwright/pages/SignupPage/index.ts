import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';

export class SignupPage extends BasePage {
  readonly projectsPage: ProjectsPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  goto() {
    return this.rootPage.goto('/#/signup/');
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signUp({ email, password, withoutPrefix }: { email: string; password: string; withoutPrefix?: boolean }) {
    if (!withoutPrefix) email = this.prefixEmail(email);

    const signUp = this.rootPage;
    await signUp.locator('button:has-text("SIGN UP")').waitFor();

    await signUp.locator(`input[placeholder="Enter your work email"]`).fill(email);
    await signUp.locator(`input[placeholder="Enter your password"]`).fill(password);
    await signUp.locator(`button:has-text("SIGN UP")`).click();
    await this.projectsPage.waitToBeRendered();
  }
}
