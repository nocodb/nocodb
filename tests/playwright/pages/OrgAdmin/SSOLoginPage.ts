import { expect, Page } from '@playwright/test';
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
    await this.rootPage.goto('/#/sso', { waitUntil: 'networkidle' });
    // click sign in with SAML
    // await this.rootPage.locator(`button:has-text("Sign in with ${title}")`).click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email, waitForUserInfoMenu = true }: { email: string; waitForUserInfoMenu?: boolean }) {
    const signIn = this.get();
    await signIn.locator('[data-testid="nc-form-org-sso-signin__email"]').waitFor();

    await signIn.locator('[data-testid="nc-form-org-sso-signin__email"]').fill(email);

    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/, waitUntil: 'networkidle' }),
      signIn.getByTestId('nc-form-signin__submit').click(),
    ]);

    // If it is cloud auth login flow then we first login sso and then redirect to localhost:4000 and there we need to login again
    if (waitForUserInfoMenu) {
      const userInfoMenu = this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]`);
      await userInfoMenu.waitFor();

      await expect(userInfoMenu).toHaveAttribute('data-email', email);
    } else {
      await this.rootPage.waitForTimeout(2000);
    }
  }
}
