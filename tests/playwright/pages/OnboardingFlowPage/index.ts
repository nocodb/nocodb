import { Locator, Page } from '@playwright/test';
import BasePage from '../Base';
import { expect } from '@playwright/test';

export class OnboardingFlowPage extends BasePage {
  /**
   * Left side image preview section
   */
  readonly imagePreviewSection: Locator;

  /**
   * Right side content section
   */
  readonly header: Locator;

  /**
   * Footer
   */
  readonly footer: Locator;
  readonly skipButton: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;

  /**
   * Content
   */
  readonly content: Locator;
  readonly question: Locator;

  /**
   * Question options
   */
  readonly questionOptions: Locator;

  constructor(rootPage: Page) {
    super(rootPage);
    this.skipButton = this.get().locator('[data-testid="nc-onboarding-flow-skip-button"]');
    this.backButton = this.get().locator('[data-testid="nc-onboarding-flow-back-button"]');
    this.nextButton = this.get().locator('[data-testid="nc-onboarding-flow-next-button"]');
    this.question = this.get().locator('[data-testid="nc-onboarding-flow-question"]');

    this.imagePreviewSection = this.get().locator('[data-testid="nc-onboarding-flow-image-preview-section"]');
    this.header = this.get().locator('[data-testid="nc-onboarding-flow-header"]');
    this.content = this.get().locator('[data-testid="nc-onboarding-flow-content"]');
    this.footer = this.get().locator('[data-testid="nc-onboarding-flow-footer"]');

    // Question options are within the question container
    this.questionOptions = this.question.locator('.nc-onboarding-option');
  }

  get() {
    return this.rootPage.locator('[data-testid="nc-onboarding-flow-container"]');
  }

  async isOnboardingFlowVisible() {
    return (await this.get().count()) > 0;
  }

  /**
   * Check if current question is single select
   */
  async isSingleSelectQuestion(): Promise<boolean> {
    return (await this.question.evaluate(el => el.classList.contains('nc-single-select-question'))) ?? false;
  }

  /**
   * Check if current question is multi select
   */
  async isMultiSelectQuestion(): Promise<boolean> {
    return (await this.question.evaluate(el => el.classList.contains('nc-multi-select-question'))) ?? false;
  }

  /**
   * Helper method to get current question type
   */
  async getCurrentQuestionType(): Promise<'singleSelect' | 'multiSelect' | void> {
    if (await this.isSingleSelectQuestion()) {
      return 'singleSelect';
    } else if (await this.isMultiSelectQuestion()) {
      return 'multiSelect';
    }
  }

  /**
   * Check if current question is the first question
   */
  async isFirstQuestion(): Promise<boolean> {
    return await this.question.evaluate(el => el.classList.contains('nc-first-question'));
  }

  /**
   * Check if current question is the last question
   */
  async isLastQuestion(): Promise<boolean> {
    return await this.question.evaluate(el => el.classList.contains('nc-last-question'));
  }

  /**
   * Verify current question index
   */
  async verifyQuestionIndex(index: number) {
    await expect(this.question).toHaveClass(`nc-active-question-index-${index}`);
  }

  /**
   * Test single select question behavior with auto-navigation
   */
  async handleSingleSelectQuestion({ optionIndex }: { optionIndex: number }) {
    const option = this.questionOptions.nth(optionIndex);

    // Select option
    await option.click();
    await expect(option).toHaveClass(/nc-selected/);

    // Wait for auto-navigation (500ms delay as per useOnboardingFlow)
    await this.rootPage.waitForTimeout(600);
  }

  /**
   * Test multi select question behavior (no auto-navigation)
   */
  async handleMultiSelectQuestion({ optionIndexes }: { optionIndexes: number[] }) {
    for (const optionIndex of optionIndexes) {
      const option = this.questionOptions.nth(optionIndex);
      await option.click();
      await expect(option).toHaveClass(/nc-selected/);
    }

    // If it is last question then no need to navigate to next question as we need to perform finish action
    if (await this.isLastQuestion()) {
      return;
    }

    await this.navigateToNextQuestion();

    // Wait for auto-navigation (500ms delay as per useOnboardingFlow)
    await this.rootPage.waitForTimeout(600);
  }

  /**
   * Navigate to next question manually (for multi-select or when auto-navigation doesn't work)
   */
  async navigateToNextQuestion() {
    await this.nextButton.click();

    // Wait for transition
    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Navigate back to previous question
   */
  async navigateToPreviousQuestion() {
    await this.backButton.click();

    // Wait for transition
    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Complete the onboarding flow by navigating through all questions
   */
  async completeOnboardingFlow({ ifAvailable = true }: { ifAvailable?: boolean } = {}) {
    /**
     * `ifAvailable` signup flow can be available at signin page also sometimes to we have to check first and then act
     */
    if (ifAvailable) {
      await this.rootPage.waitForLoadState('networkidle');

      if (!(await this.isOnboardingFlowVisible())) {
        return;
      }
    }

    await this.get().waitFor({ state: 'visible' });

    // Navigate through all questions
    for (let questionIndex = 0; questionIndex < 25; questionIndex++) {
      await this.verifyQuestionIndex(questionIndex);

      const questionType = await this.getCurrentQuestionType();
      if (questionType === 'singleSelect') {
        await this.handleSingleSelectQuestion({ optionIndex: 0 });
      } else if (questionType === 'multiSelect') {
        await this.handleMultiSelectQuestion({ optionIndexes: [0, 1] });
      }

      if (await this.isLastQuestion()) {
        break;
      }

      questionIndex++;
    }

    // On last question, the next button should say "Finish"
    await expect(this.nextButton).toHaveText('Finish');

    await this.waitForResponse({
      uiAction: () => this.nextButton.click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: 'api/v1/user/profile',
    });

    // Wait for redirection
    await this.rootPage.waitForTimeout(1000);

    await expect(this.get()).not.toBeVisible();
  }

  /**
   * Skip the onboarding flow
   */
  async skipOnboardingFlow({
    verify = false,
    ifAvailable = true,
  }: {
    verify?: boolean;
    /**
     * `ifAvailable` signup flow can be available at signin page also sometimes to we have to check first and then act
     */
    ifAvailable?: boolean;
  } = {}) {
    if (ifAvailable) {
      await this.rootPage.waitForLoadState('networkidle');

      if (!(await this.isOnboardingFlowVisible())) {
        return;
      }
    }

    await this.get().waitFor({ state: 'visible' });

    await this.waitForResponse({
      uiAction: () => this.skipButton.click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: 'api/v1/user/profile',
    });

    // Wait for redirection
    await this.rootPage.waitForTimeout(1000);

    if (verify) {
      await expect(this.get()).not.toBeVisible();
    } else {
      await this.get().waitFor({ state: 'hidden' });
    }
  }
}
