import { expect, Locator, Page } from '@playwright/test';
import BasePage from '../../Base';

export class SurveyFormPage extends BasePage {
  readonly formHeading: Locator;
  readonly formSubHeading: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly nextSlideButton: Locator;
  readonly prevSlideButton: Locator;
  readonly darkModeButton: Locator;
  readonly formFooter: Locator;

  constructor(rootPage: Page) {
    super(rootPage);
    this.formHeading = this.get().locator('[data-testid="nc-survey-form__heading"]');
    this.formSubHeading = this.get().locator('[data-testid="nc-survey-form__sub-heading"]');
    this.submitButton = this.get().locator('[data-testid="nc-survey-form__btn-submit"]');
    this.nextButton = this.get().locator('[data-testid="nc-survey-form__btn-next"]');
    this.nextSlideButton = this.get().locator('[data-testid="nc-survey-form__icon-next"]');
    this.prevSlideButton = this.get().locator('[data-testid="nc-survey-form__icon-prev"]');
    this.darkModeButton = this.get().locator('[data-testid="nc-form-dark-mode"]');
    this.formFooter = this.get().locator('[data-testid="nc-survey-form__footer"]');
  }

  get() {
    return this.rootPage.locator('html >> .nc-form-view');
  }

  async validate({
    heading,
    subHeading,
    fieldLabel,
    footer,
  }: {
    heading: string;
    subHeading: string;
    fieldLabel: string;
    footer: string;
  }) {
    await expect(this.get()).toBeVisible();
    await expect(this.formHeading).toHaveText(heading);
    await expect(this.formSubHeading).toHaveText(subHeading);
    await expect(this.formFooter).toHaveText(footer);
    await expect(this.get().locator(`[data-testid="nc-form-column-label"]`)).toHaveText(fieldLabel);

    // parse footer text ("1 / 3") to identify if last slide
    let isLastSlide = false;
    const footerText = await this.formFooter.innerText();
    const slideNumber = footerText.split(' / ')[0];
    const totalSlides = footerText.split(' / ')[1];
    if (slideNumber === totalSlides) {
      isLastSlide = true;
    }
    if (isLastSlide) {
      await expect(this.submitButton).toBeVisible();
    } else {
      await expect(this.nextButton).toBeVisible();
    }
  }

  async fill(param: { fieldLabel: string; type?: string; value?: string }) {
    await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"]`).click();
    if (param.type === 'SingleLineText') {
      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).fill(param.value);
      // press enter key
      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).press('Enter');
    } else if (param.type === 'DateTime') {
      const modal = await this.rootPage.locator('.nc-picker-datetime');
      await expect(modal).toBeVisible();
      await modal.locator('.ant-picker-now-btn').click();
      await modal.locator('.ant-picker-ok').click();
      await this.nextButton.click();
    }
  }

  async validateSuccessMessage(param: { message: string; showAnotherForm?: boolean }) {
    await expect(
      this.get().locator(`[data-testid="nc-survey-form__success-msg"]:has-text("${param.message}")`)
    ).toBeVisible();

    if (param.showAnotherForm) {
      await expect(this.get().locator(`button:has-text("Submit Another Form")`)).toBeVisible();
    }
  }
}
