import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';

export class OpenIDLoginPage extends BasePage {
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
    await signIn.locator('[name="login"]').waitFor();

    await signIn.locator(`[name="login"]`).fill(email);
    await signIn.locator(`[name="password"]`).fill('dummy-password');

    await signIn.locator(`[type="submit"]`).click();
    const authorize = this.get();

    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/ }),
      authorize.locator(`[type="submit"]`).click(),
    ]);

    await this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]:has-text("${email.split('@')[0]}")`);
  }
}
