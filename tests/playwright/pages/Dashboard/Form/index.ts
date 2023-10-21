import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

export class FormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly topbar: TopbarPage;

  // todo: All the locator should be private
  readonly addAllButton: Locator;
  readonly removeAllButton: Locator;
  readonly submitButton: Locator;

  readonly showAnotherFormRadioButton: Locator;
  readonly showAnotherFormAfter5SecRadioButton: Locator;
  readonly emailMeRadioButton: Locator;

  readonly formHeading: Locator;
  readonly formSubHeading: Locator;
  readonly afterSubmitMsg: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
    this.topbar = new TopbarPage(this);

    this.addAllButton = dashboard.get().locator('[data-testid="nc-form-add-all"]');
    this.removeAllButton = dashboard.get().locator('[data-testid="nc-form-remove-all"]');
    this.submitButton = dashboard.get().locator('[data-testid="nc-form-submit"]');

    this.showAnotherFormRadioButton = dashboard.get().locator('[data-testid="nc-form-checkbox-submit-another-form"]');
    this.showAnotherFormAfter5SecRadioButton = dashboard
      .get()
      .locator('[data-testid="nc-form-checkbox-show-blank-form"]');
    this.emailMeRadioButton = dashboard.get().locator('[data-testid="nc-form-checkbox-send-email"]');
    this.formHeading = dashboard.get().locator('[data-testid="nc-form-heading"]');
    this.formSubHeading = dashboard.get().locator('[data-testid="nc-form-sub-heading"]');
    this.afterSubmitMsg = dashboard.get().locator('[data-testid="nc-form-after-submit-msg"]');
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-form-wrapper"]');
  }

  getFormAfterSubmit() {
    return this.dashboard.get().locator('[data-testid="nc-form-wrapper-submit"]');
  }

  getFormHiddenColumn() {
    return this.get().locator('[data-testid="nc-form-hidden-column"]');
  }

  getFormFields() {
    return this.get().locator('[data-testid="nc-form-fields"]');
  }

  getDragNDropToHide() {
    return this.get().locator('[data-testid="nc-drag-n-drop-to-hide"]');
  }

  getFormFieldsRemoveIcon() {
    return this.get().locator('[data-testid="nc-field-remove-icon"]');
  }

  getFormFieldsRequired() {
    return this.get().locator('[data-testid="nc-form-input-required"] + button');
  }

  getFormFieldsInputLabel() {
    return this.get().locator('input[data-testid="nc-form-input-label"]:visible');
  }

  getFormFieldsInputHelpText() {
    return this.get().locator('input[data-testid="nc-form-input-help-text"]:visible');
  }

  async verifyFormFieldLabel({ index, label }: { index: number; label: string }) {
    await expect(this.getFormFields().nth(index).locator('[data-testid="nc-form-input-label"]')).toContainText(label);
  }

  async verifyFormFieldHelpText({ index, helpText }: { index: number; helpText: string }) {
    await expect(
      this.getFormFields().nth(index).locator('[data-testid="nc-form-input-help-text-label"]')
    ).toContainText(helpText);
  }

  async verifyFieldsIsEditable({ index }: { index: number }) {
    await expect(this.getFormFields().nth(index)).toHaveClass(/nc-editable/);
  }

  async verifyAfterSubmitMsg({ msg }: { msg: string }) {
    expect((await this.afterSubmitMsg.inputValue()).includes(msg)).toBeTruthy();
  }

  async verifyFormViewFieldsOrder({ fields }: { fields: string[] }) {
    const fieldLabels = this.get().locator('[data-testid="nc-form-input-label"]');
    await expect(fieldLabels).toHaveCount(fields.length);
    for (let i = 0; i < fields.length; i++) {
      await expect(fieldLabels.nth(i)).toContainText(fields[i]);
    }
  }

  async reorderFields({ sourceField, destinationField }: { sourceField: string; destinationField: string }) {
    // TODO: Otherwise form input boxes are not visible sometimes
    await this.rootPage.waitForTimeout(650);

    await expect(this.get().locator(`.nc-form-drag-${sourceField}`)).toBeVisible();
    await expect(this.get().locator(`.nc-form-drag-${destinationField}`)).toBeVisible();
    const src = this.get().locator(`.nc-form-drag-${sourceField.replace(' ', '')}`);
    const dst = this.get().locator(`.nc-form-drag-${destinationField.replace(' ', '')}`);
    await src.dragTo(dst);
  }

  async removeField({ field, mode }: { mode: string; field: string }) {
    // TODO: Otherwise form input boxes are not visible sometimes
    await this.rootPage.waitForTimeout(650);

    if (mode === 'dragDrop') {
      const src = this.get().locator(`.nc-form-drag-${field.replace(' ', '')}`);
      const dst = this.get().locator(`[data-testid="nc-drag-n-drop-to-hide"]`);
      await src.dragTo(dst);
    } else if (mode === 'hideField') {
      const src = this.get().locator(`.nc-form-drag-${field.replace(' ', '')}`);
      await src.locator(`[data-testid="nc-field-remove-icon"]`).click();
    }
  }

  async addField({ field, mode }: { mode: string; field: string }) {
    // TODO: Otherwise form input boxes are not visible sometimes
    await this.rootPage.waitForTimeout(650);

    if (mode === 'dragDrop') {
      const src = this.get().locator(`[data-testid="nc-form-hidden-column-${field}"] > div.ant-card-body`);
      const dst = this.get().locator(`[data-testid="nc-form-input-Country"]`);
      await src.waitFor({ state: 'visible' });
      await dst.waitFor({ state: 'visible' });
      await src.dragTo(dst, { trial: true });
      await src.dragTo(dst);
    } else if (mode === 'clickField') {
      const src = this.get().locator(`[data-testid="nc-form-hidden-column-${field}"]`);
      await src.click();
    }
  }

  async removeAllFields() {
    // TODO: Otherwise form input boxes are not visible sometimes
    await this.rootPage.waitForTimeout(1000);

    await this.removeAllButton.click();
  }

  async addAllFields() {
    await this.addAllButton.click();
  }

  async configureHeader(param: { subtitle: string; title: string }) {
    await this.waitForResponse({
      uiAction: async () => {
        await this.formHeading.click();
        await this.formHeading.fill(param.title);
        await this.formSubHeading.click();
      },
      requestUrlPathToMatch: '/api/v1/db/meta/forms',
      httpMethodsToMatch: ['PATCH'],
    });
    await this.waitForResponse({
      uiAction: async () => {
        await this.formSubHeading.click();
        await this.formSubHeading.fill(param.subtitle);
        await this.formHeading.click();
      },
      requestUrlPathToMatch: '/api/v1/db/meta/forms',
      httpMethodsToMatch: ['PATCH'],
    });
  }

  async verifyHeader(param: { subtitle: string; title: string }) {
    await expect.poll(async () => await this.formHeading.inputValue()).toBe(param.title);
    await expect.poll(async () => await this.formSubHeading.inputValue()).toBe(param.subtitle);
  }

  async fillForm(param: { field: string; value: string }[]) {
    for (let i = 0; i < param.length; i++) {
      await this.get()
        .locator(`[data-testid="nc-form-input-${param[i].field.replace(' ', '')}"]`)
        .click();
      await this.get()
        .locator(`[data-testid="nc-form-input-${param[i].field.replace(' ', '')}"] >> input`)
        .fill(param[i].value);
    }
  }

  async configureField({
    field,
    required,
    label,
    helpText,
  }: {
    field: string;
    required: boolean;
    label: string;
    helpText: string;
  }) {
    const waitForResponse = async (action: () => Promise<any>) =>
      await this.waitForResponse({
        uiAction: action,
        requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
        httpMethodsToMatch: ['PATCH'],
      });

    await this.get()
      .locator(`.nc-form-drag-${field.replace(' ', '')}`)
      .locator('div[data-testid="nc-form-input-label"]')
      .click();
    await waitForResponse(() => this.getFormFieldsInputLabel().fill(label));
    await waitForResponse(() => this.getFormFieldsInputHelpText().fill(helpText));
    if (required) {
      await waitForResponse(() => this.getFormFieldsRequired().click());
    }
    await this.formHeading.click();
  }

  async verifyField({
    field,
    required,
    label,
    helpText,
  }: {
    field: string;
    required: boolean;
    label: string;
    helpText: string;
  }) {
    let expectText = '';
    if (required) expectText = label + ' *';
    else expectText = label;

    const fieldLabel = this.get()
      .locator(`.nc-form-drag-${field.replace(' ', '')}`)
      .locator('div[data-testid="nc-form-input-label"]');
    await expect(fieldLabel).toHaveText(expectText);

    const fieldHelpText = this.get()
      .locator(`.nc-form-drag-${field.replace(' ', '')}`)
      .locator('div[data-testid="nc-form-input-help-text-label"]');
    await expect(fieldHelpText).toHaveText(helpText);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async verifyStatePostSubmit(param: { message?: string; submitAnotherForm?: boolean; showBlankForm?: boolean }) {
    if (undefined !== param.message) {
      await expect(this.getFormAfterSubmit()).toContainText(param.message);
    }
    if (true === param.submitAnotherForm) {
      await expect(this.getFormAfterSubmit().locator('button:has-text("Submit Another Form")')).toBeVisible();
    }
    if (true === param.showBlankForm) {
      await this.get().waitFor();
    }
  }

  async configureSubmitMessage(param: { message: string }) {
    await this.waitForResponse({
      uiAction: async () => {
        await this.afterSubmitMsg.click();
        await this.afterSubmitMsg.fill(param.message);
      },
      requestUrlPathToMatch: '/api/v1/db/meta/forms',
      httpMethodsToMatch: ['PATCH'],
    });
  }

  submitAnotherForm() {
    return this.getFormAfterSubmit().locator('button:has-text("Submit Another Form")');
  }

  // todo: Wait for render to complete
  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }

  async verifyAfterSubmitMenuState(param: { showBlankForm?: boolean; submitAnotherForm?: boolean; emailMe?: boolean }) {
    if (true === param.showBlankForm) {
      await expect(
        this.get().locator('[data-testid="nc-form-checkbox-show-blank-form"][aria-checked="true"]')
      ).toBeVisible();
    }
    if (true === param.submitAnotherForm) {
      await expect(
        this.get().locator('[data-testid="nc-form-checkbox-submit-another-form"][aria-checked="true"]')
      ).toBeVisible();
    }
    if (true === param.emailMe) {
      await expect(
        this.get().locator('[data-testid="nc-form-checkbox-send-email"][aria-checked="true"]')
      ).toBeVisible();
    }
  }
}
