import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';
import { OnboardingFlowPage } from '../OnboardingFlowPage';

export class SAMLLoginPage extends BasePage {
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
    await this.rootPage.locator(`button:has-text("Sign in with ${title}")`).click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signIn({ email, skipOnboardingFlow = true }: { email: string; skipOnboardingFlow?: boolean }) {
    const signIn = this.get();
    await signIn.locator('#userName').waitFor();

    await signIn.locator(`#userName`).fill(email);
    await signIn.locator(`#email`).fill(email);
    await Promise.all([
      this.rootPage.waitForNavigation({ url: /localhost:3000/ }),
      signIn.locator(`#btn-sign-in`).click(),
    ]);

    if (skipOnboardingFlow) {
      await this.onboardingFlowPage.skipOnboardingFlow();
    }

    const userInfoMenu = this.rootPage.locator(`[data-testid="nc-sidebar-userinfo"]`);
    await userInfoMenu.waitFor();

    await expect(userInfoMenu).toHaveAttribute('data-email', email);
  }
}
