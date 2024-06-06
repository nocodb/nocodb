import { expect, Locator, Page } from '@playwright/test';
import { UITypes } from 'nocodb-sdk';
import BasePage from '../../Base';
import { getTextExcludeIconText } from '../../../tests/utils/general';
import { CellPageObject } from '../common/Cell';

export class SurveyFormPage extends BasePage {
  readonly cell: CellPageObject;

  readonly formHeading: Locator;
  readonly formSubHeading: Locator;
  readonly fillFormButton: Locator;
  readonly submitConfirmationButton: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly nextSlideButton: Locator;
  readonly prevSlideButton: Locator;
  readonly darkModeButton: Locator;
  readonly formFooter: Locator;

  constructor(rootPage: Page) {
    super(rootPage);
    this.cell = new CellPageObject(this);
    this.formHeading = this.get().locator('[data-testid="nc-survey-form__heading"]');
    this.formSubHeading = this.get().locator('[data-testid="nc-survey-form__sub-heading"]');
    this.fillFormButton = this.get().locator('[data-testid="nc-survey-form__fill-form-btn"]');
    this.submitConfirmationButton = this.get().locator('[data-testid="nc-survey-form__btn-submit-confirm"]');
    this.submitButton = this.rootPage.locator(
      '.nc-survery-form__confirmation_modal [data-testid="nc-survey-form__btn-submit"]'
    );
    this.nextButton = this.get().locator('[data-testid="nc-survey-form__btn-next"]');
    this.nextSlideButton = this.get().locator('[data-testid="nc-survey-form__icon-next"]');
    this.prevSlideButton = this.get().locator('[data-testid="nc-survey-form__icon-prev"]');
    this.darkModeButton = this.get().locator('[data-testid="nc-form-dark-mode"]');
    this.formFooter = this.get().locator('[data-testid="nc-survey-form__footer"]');
  }

  get() {
    return this.rootPage.locator('html >> .nc-form-view');
  }

  async validateHeaders({ heading, subHeading }: { heading: string; subHeading: string }) {
    await expect(this.get()).toBeVisible();
    await expect(this.formHeading).toHaveText(heading);
    await expect(this.formSubHeading).toHaveText(subHeading);
  }

  async validate({ fieldLabel, footer }: { fieldLabel: string; footer: string }) {
    await expect(this.get()).toBeVisible();

    await expect(this.formFooter).toHaveText(footer);

    const locator = this.get().locator(`[data-testid="nc-form-column-label"]`);
    let fieldText = await getTextExcludeIconText(locator);

    // replace whitespace with ' ' for fieldLabel & fieldText
    fieldLabel = fieldLabel.replace(/\u00A0/g, ' ');
    fieldText = fieldText.replace(/\u00A0/g, ' ');

    expect(fieldText).toBe(fieldLabel);

    // parse footer text ("1 / 3") to identify if last slide
    let isLastSlide = false;
    const footerText = await this.formFooter.innerText();
    const slideNumber = footerText.split(' / ')[0];
    const totalSlides = footerText.split(' / ')[1];
    if (slideNumber === totalSlides) {
      isLastSlide = true;
    }
    if (isLastSlide) {
      await expect(this.submitConfirmationButton).toBeVisible();
    } else {
      await expect(this.nextButton).toBeVisible();
    }
  }

  async fill(param: { fieldLabel: string; type?: string; value?: string; skipNavigation?: boolean }) {
    await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"]`).click();

    if (param.type === 'SingleLineText') {
      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).fill(param.value);
    } else if (param.type === 'DateTime') {
      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).first().click();
      const modal = this.rootPage.locator('.nc-picker-datetime');
      await expect(modal).toBeVisible();
      await modal.locator('.nc-date-picker-now-btn').click();
      await modal.waitFor({ state: 'hidden' });
    } else if (param.type === UITypes.LongText) {
      await this.get()
        .locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> textarea`)
        .waitFor({ state: 'visible' });
      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> textarea`).click();

      await this.get()
        .locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> textarea`)
        .fill(param.value);
    } else {
      await this.get()
        .locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`)
        .waitFor({ state: 'visible' });

      await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).fill(param.value);

      if ([UITypes.Date, UITypes.Time, UITypes.Year, UITypes.DateTime].includes(param.type)) {
        // press enter key
        await this.get().locator(`[data-testid="nc-survey-form__input-${param.fieldLabel}"] >> input`).press('Enter');
      }
    }

    await this.get().locator(`[data-testid="nc-form-column-label"]`).click();

    if (!param.skipNavigation) {
      await this.nextButton.click();
    }
    // post next button click, allow transitions to complete
    await this.rootPage.waitForTimeout(100);
  }

  async validateSuccessMessage(param: { message: string; showAnotherForm?: boolean; isCustomMsg?: boolean }) {
    await this.get().locator('[data-testid="nc-survey-form__success-msg"]').waitFor({ state: 'visible' });

    if (param.isCustomMsg) {
      await this.get()
        .locator('[data-testid="nc-survey-form__success-msg"]')
        .locator('.tiptap.ProseMirror')
        .waitFor({ state: 'visible' });
    }

    await this.rootPage.waitForTimeout(200);
    await expect(
      this.get().locator(`[data-testid="nc-survey-form__success-msg"]:has-text("${param.message}")`)
    ).toBeVisible();

    if (param.showAnotherForm) {
      await expect(this.get().locator(`button:has-text("Submit Another Form")`)).toBeVisible();
    }
  }

  async clickFillForm() {
    await this.fillFormButton.click();
  }

  async confirmAndSubmit() {
    await this.submitConfirmationButton.click();
    await this.submitButton.waitFor({ state: 'visible' });

    await this.submitButton.click();

    await this.submitButton.waitFor({ state: 'hidden' });
  }

  async getFormFieldErrors() {
    const fieldErrorEl = this.get().locator('.ant-form-item-explain');
    return {
      locator: fieldErrorEl,
      verify: async ({ hasError, hasErrorMsg }: { hasError?: boolean; hasErrorMsg?: string | RegExp }) => {
        if (hasError !== undefined) {
          if (hasError) {
            await expect(fieldErrorEl).toBeVisible();
          } else {
            await expect(fieldErrorEl).not.toBeVisible();
          }
        }

        if (hasErrorMsg !== undefined) {
          await expect(fieldErrorEl).toBeVisible();

          await expect(fieldErrorEl.locator('> div').filter({ hasText: hasErrorMsg }).first()).toHaveText(hasErrorMsg);
        }
      },
    };
  }
}
