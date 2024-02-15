import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';

export class GoogleLoginPage extends BasePage {
  readonly projectsPage: ProjectsPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
  }

  async goto(title = 'test') {
    // reload page to get latest app info
    await this.rootPage.reload({ waitUntil: 'networkidle' });
    // click sign in with SAML
    await this.rootPage.locator(`a:has-text("Sign in with google")`).click();

    await this.rootPage.waitForNavigation({ url: /accounts\.google\.com/ });
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn(_: { email: string }) {
    // skipping for now as it requires google account
    // todo: later we can mock backend(google oauth2 endpoint calls) to test this
  }
}
