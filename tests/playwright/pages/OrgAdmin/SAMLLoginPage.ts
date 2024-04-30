import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';

export class SAMLLoginPage extends BasePage {
  readonly projectsPage: ProjectsPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
  }

  async goto(title = 'test') {
    // reload page to get latest app info
    await this.rootPage.reload({ waitUntil: 'networkidle' });
    // click sign in with SAML
    await this.rootPage.locator(`button:has-text("Sign in with ${title}")`).click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email }: { email: string }) {
    const signIn = this.get();
    await signIn.locator('#userName').waitFor();

    await signIn.locator(`#userName`).fill(email);
    await signIn.locator(`#email`).fill(email);
    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/ }),
      signIn.locator(`#btn-sign-in`).click(),
    ]);

    await this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]:has-text("${email.split('@')[0]}")`);
  }
}
