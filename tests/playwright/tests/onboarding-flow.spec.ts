import { test } from '@playwright/test';
import { OnboardingFlowPage } from '../pages/OnboardingFlowPage';

test.describe.skip('Onboarding Flow', () => {
  let onboardingFlowPage: OnboardingFlowPage;

  test.beforeEach(async ({ page }) => {
    // Navigate to the onboarding flow page
    await page.goto('/');

    // Wait for onboarding flow to be visible
    await page.waitForSelector('[data-testid="nc-onboarding-flow-container"]');

    onboardingFlowPage = new OnboardingFlowPage(page);
  });

  test.describe('Flow Completion', () => {
    test('should complete onboarding flow', async () => {
      // Complete the entire flow
      await onboardingFlowPage.completeOnboardingFlow();
    });

    test('should skip onboarding flow', async () => {
      // Skip the flow
      await onboardingFlowPage.skipOnboardingFlow({ verify: true });
    });
  });
});
