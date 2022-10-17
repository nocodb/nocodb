// playwright-dev-page.ts
import { Locator, expect } from "@playwright/test";
import { DashboardPage } from "..";
import BasePage from "../../Base";

export class FormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly dashboardPage: DashboardPage;

  readonly addAllButton: Locator;
  readonly removeAllButton: Locator;
  readonly submitButton: Locator;

  readonly showAnotherFormRadioButton: Locator;
  readonly showAnotherFormAfter5SecRadioButton: Locator;
  readonly emailMeRadioButton: Locator;

  readonly formHeading: Locator;
  readonly formSubHeading: Locator;
  readonly afterSubmitMsg: Locator;

  constructor(dashboardPage: DashboardPage) {
    super(dashboardPage.rootPage);
    this.dashboard = dashboardPage;
    this.addAllButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-add-all"]');
    this.removeAllButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-remove-all"]');
    this.submitButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-submit"]');

    this.showAnotherFormRadioButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-checkbox-submit-another-form"]');
    this.showAnotherFormAfter5SecRadioButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-checkbox-show-blank-form"]');
    this.emailMeRadioButton = dashboardPage
      .get()
      .locator('[data-pw="nc-form-checkbox-send-email"]');
    this.formHeading = dashboardPage
      .get()
      .locator('[data-pw="nc-form-heading"]');
    this.formSubHeading = dashboardPage
      .get()
      .locator('[data-pw="nc-form-sub-heading"]');
    this.afterSubmitMsg = dashboardPage
      .get()
      .locator('[data-pw="nc-form-after-submit-msg"]');
  }

  /*
  data-pw="nc-form-wrapper-submit"
  data-pw="nc-form-wrapper"

  data-pw="nc-form-heading"
  data-pw="nc-form-sub-heading"
  data-pw="nc-form-field"
  data-pw="nc-form-input-label"
  data-pw="nc-field-remove-icon"
  data-pw="nc-form-input-required"
  data-pw="nc-form-input-label"
  data-pw="nc-form-input-help-text"
  :data-pw="`nc-form-input-${element.title.replaceAll(' ', '')}`"
  data-pw="nc-form-submit"

  data-pw="nc-form-after-submit-msg"
  data-pw="nc-form-checkbox-submit-another-form"
  data-pw="nc-form-checkbox-show-blank-form"
  data-pw="nc-form-checkbox-send-email"

  data-pw="nc-form-add-all"
  data-pw="nc-form-remove-all"
  :data-pw="`nc-form-hidden-column-${element.label}`"
  data-pw="nc-drag-n-drop-to-hide"
  */

  get() {
    return this.dashboard.get().locator('[data-pw="nc-form-wrapper"]');
  }

  getFormAfterSubmit() {
    return this.dashboard.get().locator('[data-pw="nc-form-wrapper-submit"]');
  }

  getFormHiddenColumn() {
    return this.get().locator('[data-pw="nc-form-hidden-column"]');
  }

  getFormFields() {
    return this.get().locator('[data-pw="nc-form-field"]');
  }

  getDragNDropToHide() {
    return this.get().locator('[data-pw="nc-drag-n-drop-to-hide"]');
  }

  getFormFieldsRemoveIcon() {
    return this.get().locator('[data-pw="nc-field-remove-icon"]');
  }

  getFormFieldsRequired() {
    return this.get().locator('[data-pw="nc-form-input-required"]');
  }

  getFormFieldsInputLabel() {
    return this.get().locator('[data-pw="nc-form-input-label"]');
  }

  getFormFieldsInputHelpText() {
    return this.get().locator('[data-pw="nc-form-input-help-text"]');
  }

  ///////////////////////////
  // Form Actions

  async verifyFormViewFieldsOrder({ fields }: { fields: string[] }) {
    let fieldLabels = await this.get().locator(
      '[data-pw="nc-form-input-label"]'
    );
    expect(await fieldLabels.count()).toBe(fields.length);
    for (let i = 0; i < fields.length; i++) {
      // using toContainText instead of toBe because of the extra
      // text (*) in the label for required fields
      await expect(await fieldLabels.nth(i)).toContainText(fields[i]);
    }
  }

  async reorderFields({
    sourceField,
    destinationField,
  }: {
    sourceField: string;
    destinationField: string;
  }) {
    expect(
      await this.get().locator(`.nc-form-drag-${sourceField}`)
    ).toBeVisible();
    expect(
      await this.get().locator(`.nc-form-drag-${destinationField}`)
    ).toBeVisible();
    let src = await this.get().locator(
      `.nc-form-drag-${sourceField.replace(" ", "")}`
    );
    let dst = await this.get().locator(
      `.nc-form-drag-${destinationField.replace(" ", "")}`
    );
    await src.dragTo(dst);
  }

  async removeField({ field, mode }: { mode: string; field: string }) {
    if (mode === "dragDrop") {
      let src = await this.get().locator(
        `.nc-form-drag-${field.replace(" ", "")}`
      );
      let dst = await this.get().locator(`[data-pw="nc-drag-n-drop-to-hide"]`);
      await src.dragTo(dst);
    } else if (mode === "hideField") {
      let src = await this.get().locator(
        `.nc-form-drag-${field.replace(" ", "")}`
      );
      await src.locator(`[data-pw="nc-field-remove-icon"]`).click();
    }
  }

  async addField({ field, mode }: { mode: string; field: string }) {
    if (mode === "dragDrop") {
      let src = await this.get().locator(
        `[data-pw="nc-form-hidden-column-${field}"]`
      );
      let dst = await this.get().locator(`.nc-form-drag-Country`);
      await src.dragTo(dst);
    } else if (mode === "clickField") {
      let src = await this.get().locator(
        `[data-pw="nc-form-hidden-column-${field}"]`
      );
      await src.click();
    }
  }

  async removeAllFields() {
    await this.removeAllButton.click();
  }

  async addAllFields() {
    await this.addAllButton.click();
  }

  async configureHeader(param: { subtitle: string; title: string }) {
    await this.formHeading.fill(param.title);
    await this.formSubHeading.fill(param.subtitle);
  }

  async verifyHeader(param: { subtitle: string; title: string }) {
    expect(await this.formHeading.inputValue()).toBe(param.title);
    expect(await this.formSubHeading.inputValue()).toBe(param.subtitle);
  }

  async fillForm(param: { field: string; value: string }[]) {
    for (let i = 0; i < param.length; i++) {
      await this.get()
        .locator(
          `[data-pw="nc-form-input-${param[i].field.replace(
            " ",
            ""
          )}"] >> input`
        )
        .fill(param[i].value);
    }
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async verifyStatePostSubmit(param: {
    message?: string;
    submitAnotherForm?: boolean;
    showBlankForm?: boolean;
  }) {
    if (undefined !== param.message) {
      expect(await this.getFormAfterSubmit()).toContainText(param.message);
    }
    if (true === param.submitAnotherForm) {
      expect(
        await this.getFormAfterSubmit().locator(
          'button:has-text("Submit Another Form")'
        )
      ).toBeVisible();
    }
    if (true === param.showBlankForm) {
      await this.get().waitFor();
    }
  }

  async configureSubmitMessage(param: { message: string }) {
    await this.afterSubmitMsg.fill(param.message);
  }

  submitAnotherForm() {
    return this.getFormAfterSubmit().locator(
      'button:has-text("Submit Another Form")'
    );
  }

  verifyAfterSubmitMenuState(param: {
    showBlankForm?: boolean;
    submitAnotherForm?: boolean;
    emailMe?: boolean;
  }) {
    if (true === param.showBlankForm) {
      expect(
        this.get().locator(
          '[data-pw="nc-form-checkbox-show-blank-form"][aria-checked="true"]'
        )
      ).toBeVisible();
    }
    if (true === param.submitAnotherForm) {
      expect(
        this.get().locator(
          '[data-pw="nc-form-checkbox-submit-another-form"][aria-checked="true"]'
        )
      ).toBeVisible();
    }
    if (true === param.emailMe) {
      expect(
        this.get().locator(
          '[data-pw="nc-form-checkbox-send-email"][aria-checked="true"]'
        )
      ).toBeVisible();
    }
  }
}
