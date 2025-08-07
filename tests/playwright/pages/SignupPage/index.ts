import { Page } from '@playwright/test';
import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';
import { OnboardingFlowPage } from '../OnboardingFlowPage';

export class SignupPage extends BasePage {
  readonly projectsPage: ProjectsPage;
  readonly onboardingFlowPage: OnboardingFlowPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.projectsPage = new ProjectsPage(rootPage);
    this.onboardingFlowPage = new OnboardingFlowPage(rootPage);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  async goto() {
    await this.rootPage.locator('[href="#/signup"]').click();
  }

  get() {
    return this.rootPage.locator('html');
  }

  async signUp({
    email,
    password,
    withoutPrefix,
    expectedError,
    skipOnboardingFlow = true,
  }: {
    email: string;
    password: string;
    withoutPrefix?: boolean;
    expectedError?: string;
    skipOnboardingFlow?: boolean;
  }) {
    if (!withoutPrefix) email = this.prefixEmail(email);

    const signUp = this.get();
    await signUp.locator('button:has-text("SIGN UP")').waitFor();

    await signUp.locator(`input[placeholder="Enter your work email"]`).fill(email);
    await signUp.locator(`input[placeholder="Enter your password"]`).fill(password);
    await signUp.locator(`button:has-text("SIGN UP")`).click();
    if (expectedError) {
      await expect(signUp.getByTestId('nc-signup-error')).toHaveText(expectedError);
    } else {
      await this.rootPage.waitForLoadState('networkidle');

      if (skipOnboardingFlow) {
        // Singup flow has to be visible after signup so we have to make `ifAvailable = false` so that it doesn't check for onboarding flow visibility
        // make it false once we enable onboarding flow tests
        await this.onboardingFlowPage.skipOnboardingFlow({ ifAvailable: true });
      } else {
        // Singup flow has to be visible after signup so we have to make `ifAvailable = false` so that it doesn't check for onboarding flow visibility
        // make it false once we enable onboarding flow tests
        await this.onboardingFlowPage.completeOnboardingFlow({ ifAvailable: true });
      }
    }
  }
}
