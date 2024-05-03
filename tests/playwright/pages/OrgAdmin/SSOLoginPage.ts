import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';

export class CloudSSOLoginPage extends BasePage {
  readonly projectsPage: ProjectsPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
  }

  async goto(_email: string) {
    // reload page to get latest app info
    await this.rootPage.goto('/#/sso');
    // click sign in with SAML
    // await this.rootPage.locator(`button:has-text("Sign in with ${title}")`).click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email }: { email: string }) {
    const signIn = this.get();
    await signIn.locator('[data-testid="nc-form-org-sso-signin__email"]').waitFor();

    await signIn.locator('[data-testid="nc-form-org-sso-signin__email"]').fill(email);

    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/ }),
      signIn.getByTestId('nc-form-signin__submit').click(),
    ]);

    await this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]:has-text("${email.split('@')[0]}")`);
  }
}
