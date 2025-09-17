import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { OnboardingFlowPage } from '../OnboardingFlowPage';

export class GoogleLoginPage extends BasePage {
  readonly projectsPage: ProjectsPage;
  readonly onboardingFlowPage: OnboardingFlowPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
    this.onboardingFlowPage = new OnboardingFlowPage(rootPage);
  }

  async goto(title = 'test') {
    // reload page to get latest app info
    await this.rootPage.reload({ waitUntil: 'networkidle' });
    // click sign in with SAML
    await Promise.all([
      this.rootPage.waitForNavigation({ url: /accounts\.google\.com/, waitUntil: 'networkidle' }),
      this.rootPage.locator(`a:has-text("Sign in with google")`).click(),
    ]);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email, skipOnboardingFlow = true }: { email: string; skipOnboardingFlow?: boolean }) {
    // skipping for now as it requires google account
    // todo: later we can mock backend(google oauth2 endpoint calls) to test this

    if (skipOnboardingFlow) {
      await this.onboardingFlowPage.skipOnboardingFlow();
    }
  }
}
