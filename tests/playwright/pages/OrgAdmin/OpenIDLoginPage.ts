import { expect, Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { CloudSSOLoginPage } from './SSOLoginPage';

export class CloudOpenIDLoginPage extends BasePage {
  readonly projectsPage: ProjectsPage;
  readonly ssoLoginPage: CloudSSOLoginPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
    this.ssoLoginPage = new CloudSSOLoginPage(rootPage);
  }

  async goto(_title = 'test', email: string) {
    await this.ssoLoginPage.goto(email);
    await this.ssoLoginPage.signIn({ email, waitForUserInfoMenu: false });
    // // reload page to get latest app info
    // await this.rootPage.reload({ waitUntil: 'networkidle' });
    // // click sign in with SAML
    // await this.rootPage.locator(`button:has-text("Sign in with ${title}")`).click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email }: { email: string }) {
    const signIn = this.get();
    const loginLocator = signIn.locator('[name="login"]');
    await loginLocator.waitFor({ state: 'visible' });

    await loginLocator.fill(email);
    await signIn.locator(`[name="password"]`).fill('dummy-password');

    await signIn.locator(`[type="submit"]`).click();

    await loginLocator.waitFor({ state: 'hidden' });

    const authorize = this.get();

    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/, waitUntil: 'networkidle' }),
      authorize.locator(`[type="submit"]`).click(),
    ]);

    const userInfoMenu = this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]`);
    await userInfoMenu.waitFor();

    await expect(userInfoMenu).toHaveAttribute('data-email', email);
  }
}
