import { expect, Locator } from '@playwright/test';
import { StringValidationType, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';
import { FormConditionalFieldsPage } from './formConditionalFields';

export class FormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly topbar: TopbarPage;
  readonly conditionalFields: FormConditionalFieldsPage;

  // todo: All the locator should be private
  readonly addOrRemoveAllButton: Locator;
  readonly submitButton: Locator;

  readonly showAnotherFormRadioButton: Locator;
  readonly showAnotherFormAfter5SecRadioButton: Locator;
  readonly emailMeRadioButton: Locator;

  readonly formHeading: Locator;
  readonly formSubHeading: Locator;
  readonly afterSubmitMsg: Locator;

  readonly formFields: Locator;

  // validation
  readonly fieldPanel: Locator;
  readonly customValidationBtn: Locator;
  readonly customValidationDropdown: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
    this.topbar = new TopbarPage(this);
    this.conditionalFields = new FormConditionalFieldsPage(this);

    this.addOrRemoveAllButton = dashboard
      .get()
      .locator('[data-testid="nc-form-show-all-fields"]')
      .locator('.nc-switch');
    this.submitButton = dashboard.get().locator('[data-testid="nc-form-submit"]');

    this.showAnotherFormRadioButton = dashboard.get().locator('[data-testid="nc-form-checkbox-submit-another-form"]');
    this.showAnotherFormAfter5SecRadioButton = dashboard
      .get()
      .locator('[data-testid="nc-form-checkbox-show-blank-form"]');
    this.emailMeRadioButton = dashboard.get().locator('[data-testid="nc-form-checkbox-send-email"]');
    this.formHeading = dashboard.get().locator('[data-testid="nc-form-heading"]');
    this.formSubHeading = dashboard.get().locator('[data-testid="nc-form-sub-heading"] .tiptap.ProseMirror');
    this.afterSubmitMsg = dashboard.get().locator('[data-testid="nc-form-after-submit-msg"] .tiptap.ProseMirror');

    this.formFields = dashboard.get().locator('.nc-form-fields-list');

    // validation
    this.fieldPanel = dashboard.get().locator('.nc-form-field-right-panel');
    this.customValidationBtn = this.fieldPanel.locator('.nc-custom-validation-btn');
    this.customValidationDropdown = this.rootPage.locator('.nc-custom-validator-dropdown');
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-form-wrapper"]');
  }

  getFormAfterSubmit() {
    return this.dashboard.get().locator('[data-testid="nc-form-wrapper-submit"]');
  }

  getFormFields() {
    return this.get().locator('[data-testid="nc-form-fields"]');
  }

  getFormFieldsRequired() {
    return this.get().locator('[data-testid="nc-form-input-required"]');
  }

  getFormFieldsInputLabel() {
    return this.get().locator('textarea[data-testid="nc-form-input-label"]:visible');
  }

  getFormFieldsInputHelpText() {
    return this.get().locator('[data-testid="nc-form-input-help-text"] .tiptap.ProseMirror:visible');
  }

  async verifyFormFieldLabel({ index, label }: { index: number; label: string }) {
    await expect(this.getFormFields().nth(index).locator('[data-testid="nc-form-input-label"]')).toContainText(label);
  }

  async verifyFormFieldHelpText({ index, helpText }: { index: number; helpText: string }) {
    await expect(this.getFormFields().nth(index).locator('[data-testid="nc-form-help-text"]')).toContainText(helpText);
  }

  async verifyFieldsIsEditable({ index }: { index: number }) {
    await expect(this.getFormFields().nth(index)).toHaveClass(/nc-editable/);
  }

  async verifyAfterSubmitMsg({ msg }: { msg: string }) {
    expect((await this.afterSubmitMsg.textContent()).includes(msg)).toBeTruthy();
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

  async removeField({ field, mode }: { mode: 'dragDrop' | 'hideField'; field: string }) {
    // TODO: Otherwise form input boxes are not visible sometimes
    await this.rootPage.waitForTimeout(650);

    if (mode === 'dragDrop') {
      const src = this.get().locator(`.nc-form-drag-${field.replace(' ', '')}`);
      const dst = this.get().locator(`[data-testid="nc-drag-n-drop-to-hide"]`);
      await src.dragTo(dst);
    } else if (mode === 'hideField') {
      // in form-v2, hide field will be using right sidebar
      await this.formFields.locator(`[data-testid="nc-form-field-item-${field}"]`).locator('.nc-switch').click();
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
      await this.formFields.locator(`[data-testid="nc-form-field-item-${field}"]`).locator('.nc-switch').click();
    }
  }

  async removeAllFields() {
    if (await this.addOrRemoveAllButton.isChecked()) {
      await this.addOrRemoveAllButton.click();
    } else {
      await this.addOrRemoveAllButton.click();
      await this.addOrRemoveAllButton.click();
    }
  }

  async addAllFields() {
    if (!(await this.addOrRemoveAllButton.isChecked())) {
      await this.addOrRemoveAllButton.click();
    }
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
    await expect.poll(async () => await this.formSubHeading.textContent()).toBe(param.subtitle);
  }

  async fillForm(param: { field: string; value: string; type?: UITypes }[]) {
    for (let i = 0; i < param.length; i++) {
      await this.get()
        .locator(`[data-testid="nc-form-input-${param[i].field.replace(' ', '')}"]`)
        .click();

      switch (param[i].type) {
        case UITypes.LongText: {
          await this.get()
            .locator(`[data-testid="nc-form-input-${param[i].field.replace(' ', '')}"] >> textarea`)
            .fill(param[i].value);

          break;
        }
        default: {
          await this.get()
            .locator(`[data-testid="nc-form-input-${param[i].field.replace(' ', '')}"] >> input`)
            .fill(param[i].value);

          if ([UITypes.Date, UITypes.Time, UITypes.Year, UITypes.DateTime].includes(param[i].type)) {
            await this.rootPage.keyboard.press('Enter');
          }

          await this.getVisibleField({ title: param[i].field }).click();
        }
      }

      await this.rootPage.waitForTimeout(200);
    }
  }

  getVisibleField({ title }: { title: string }) {
    return this.get()
      .locator(`[data-testid="nc-form-fields"][data-title="${title}"]`)
      .locator('[data-testid="nc-form-input-label"]');
  }

  async selectVisibleField({ title }: { title: string }) {
    const field = this.getVisibleField({ title });

    await field.scrollIntoViewIfNeeded();
    await field.click();

    // Wait for field settings right pannel
    await this.fieldPanel.waitFor({ state: 'visible' });
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

    await this.selectVisibleField({ title: field });

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

    const fieldLabel = this.getVisibleField({ title: field });
    await fieldLabel.scrollIntoViewIfNeeded();
    await expect(fieldLabel).toHaveText(expectText);

    const fieldHelpText = this.get()
      .locator(`.nc-form-drag-${field.replace(' ', '')}`)
      .locator('div[data-testid="nc-form-input-help-text-label"] .tiptap.ProseMirror');
    await expect(fieldHelpText).toHaveText(helpText);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async verifyStatePostSubmit(param: { message?: string; submitAnotherForm?: boolean; showBlankForm?: boolean }) {
    await this.rootPage.locator('.nc-form-success-msg').waitFor({ state: 'visible' });

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

  async getCustomValidationTypeOption({
    type,
    currValItem,
    index,
  }: {
    type: StringValidationType;
    currValItem: Locator;
    index: number;
  }) {
    await currValItem.locator('.nc-custom-validation-type-selector .ant-select-selector').click();

    const typeSelectorDropdown = this.rootPage.locator(`.nc-custom-validation-type-dropdown-${index}`);
    await typeSelectorDropdown.waitFor();

    const option = typeSelectorDropdown.getByTestId(`nc-custom-validation-type-option-${type}`);
    await option.scrollIntoViewIfNeeded();

    return {
      option: this.rootPage.getByTestId(`nc-custom-validation-type-option-${type}`),
      select: async () => {
        await option.click();
        await typeSelectorDropdown.waitFor({ state: 'hidden' });
      },
      closeSelector: async () =>
        await currValItem.locator('.nc-custom-validation-type-selector .ant-select-selector').click(),
      verify: async ({ isDisabled = false }: { isDisabled: boolean }) => {
        if (isDisabled) {
          await expect(option).toHaveClass(/ant-select-item-option-disabled/);
        } else {
          await expect(option).not.toHaveClass(/ant-select-item-option-disabled/);
        }
      },
    };
  }

  async addCustomValidation({
    type,
    value,
    errorMsg,
    index,
  }: {
    type: StringValidationType;
    value: string;
    errorMsg?: string;
    index: number;
  }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    await this.customValidationBtn.click();

    const dropdown = this.customValidationDropdown;
    await dropdown.waitFor({ state: 'visible' });

    await dropdown.locator('.nc-custom-validation-add-btn').click();

    const currValItem = this.customValidationDropdown.getByTestId(`nc-custom-validation-item-${index}`);

    await currValItem.waitFor({ state: 'visible' });

    // Select type
    const { select } = await this.getCustomValidationTypeOption({ type, currValItem, index });
    await select();

    // add value
    const valValueInput = currValItem.locator('.custom-validation-input >> input');
    await valValueInput.click();
    await valValueInput.fill(value);

    if (errorMsg !== undefined) {
      const valErrorMsgInput = currValItem.locator('.nc-custom-validation-error-message-input');
      await valErrorMsgInput.click();
      await valErrorMsgInput.fill(errorMsg);
    }

    //close dropdown
    await this.customValidationBtn.click();
    await dropdown.waitFor({ state: 'hidden' });
  }

  async updateCustomValidation({
    type,
    value,
    errorMsg,
    index,
  }: {
    type?: StringValidationType;
    value?: string;
    errorMsg?: string;
    index: number;
  }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    await this.customValidationBtn.click();

    const dropdown = this.customValidationDropdown;
    await dropdown.waitFor({ state: 'visible' });

    const currValItem = this.customValidationDropdown.getByTestId(`nc-custom-validation-item-${index}`);

    await currValItem.waitFor({ state: 'visible' });

    if (type) {
      // Select type
      const { select } = await this.getCustomValidationTypeOption({ type, currValItem, index });
      await select();
    }

    // update value
    if (value !== undefined) {
      const valValueInput = currValItem.locator('.custom-validation-input >> input');
      await valValueInput.click();
      await valValueInput.fill(value);
    }

    if (errorMsg !== undefined) {
      const valErrorMsgInput = currValItem.locator('.nc-custom-validation-error-message-input');
      await valErrorMsgInput.click();
      await valErrorMsgInput.fill(errorMsg);
    }

    //close dropdown
    await this.customValidationBtn.click();
    await dropdown.waitFor({ state: 'hidden' });
  }

  async verifyCustomValidationSelector({
    type,
    value: _value,
    errorMsg: _errorMsg,
    index,
  }: {
    type: StringValidationType;
    value?: string;
    errorMsg?: string;
    index: number;
  }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    await this.customValidationBtn.click();

    const dropdown = this.customValidationDropdown;
    await dropdown.waitFor({ state: 'visible' });

    const currValItem = this.customValidationDropdown.getByTestId(`nc-custom-validation-item-${index}`);
    await currValItem.waitFor({ state: 'visible' });

    const { verify } = await this.getCustomValidationTypeOption({
      type,
      currValItem,
      index,
    });
    await verify({ isDisabled: true });

    //close dropdown
    await this.customValidationBtn.click();
    await dropdown.waitFor({ state: 'hidden' });
  }
  async verifyCustomValidationValue({ value, hasError, index }: { value?: string; hasError?: boolean; index: number }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    await this.customValidationBtn.click();

    const dropdown = this.customValidationDropdown;
    await dropdown.waitFor({ state: 'visible' });

    const currValItem = this.customValidationDropdown.getByTestId(`nc-custom-validation-item-${index}`);
    await currValItem.waitFor({ state: 'visible' });

    //  value
    if (value !== undefined) {
      const valValueInput = currValItem.locator('.custom-validation-input >> input');
      await expect(valValueInput).toHaveValue(value);
    }

    if (hasError) {
      const valValueErr = currValItem.locator(
        '.nc-custom-validation-input-wrapper .nc-custom-validation-item-error-icon'
      );

      await expect(valValueErr).toBeVisible();
    }

    //close dropdown
    await this.customValidationBtn.click();
    await dropdown.waitFor({ state: 'hidden' });
  }

  async removeCustomValidationItem({ index }: { index: number }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    await this.customValidationBtn.click();

    const dropdown = this.customValidationDropdown;
    await dropdown.waitFor({ state: 'visible' });

    const currValItem = this.customValidationDropdown.getByTestId(`nc-custom-validation-item-${index}`);
    await currValItem.waitFor({ state: 'visible' });

    await currValItem.locator('.nc-custom-validation-delete-item').click();

    await currValItem.waitFor({ state: 'hidden' });

    //close dropdown
    await this.customValidationBtn.click();
    await dropdown.waitFor({ state: 'hidden' });
  }

  async verifyCustomValidationCount({ count }: { count: number }) {
    await this.customValidationBtn.waitFor({ state: 'visible' });
    const countStr = await this.customValidationBtn.locator('.nc-custom-validation-count').textContent();

    expect(parseInt(countStr) || 0).toEqual(count);
  }

  async getFormFieldsEmailPhoneUrlValidatorConfig({
    type,
  }: {
    type: UITypes.Email | UITypes.PhoneNumber | UITypes.URL;
  }) {
    const validateBtn = this.get().getByTestId(`nc-form-field-validate-${type}`);

    return {
      locator: validateBtn,
      click: async ({ enable }: { enable: boolean }) => {
        await validateBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateBtn.isChecked();

        if ((enable && !isEnabled) || (!enable && isEnabled)) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({ isEnabled, isDisabled }: { isEnabled?: boolean; isDisabled?: boolean }) => {
        await validateBtn.waitFor({ state: 'visible' });

        if (isEnabled !== undefined) {
          if (isEnabled) {
            await expect(validateBtn).toBeChecked();
          } else {
            await expect(validateBtn).not.toBeChecked();
          }
        }

        if (isDisabled !== undefined) {
          if (isDisabled) {
            await expect(validateBtn).toBeDisabled();
          } else {
            await expect(validateBtn).not.toBeDisabled();
          }
        }
      },
    };
  }

  async getFormFieldsValidateWorkEmailConfig() {
    const validateWorkEmailBtn = this.get().getByTestId('nc-form-field-allow-only-work-email');

    return {
      locator: validateWorkEmailBtn,
      click: async ({ enable }: { enable: boolean }) => {
        await validateWorkEmailBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateWorkEmailBtn.isChecked();

        if ((enable && !isEnabled) || (!enable && isEnabled)) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateWorkEmailBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({
        isEnabled,
        isDisabled,
        isVisible,
      }: {
        isEnabled?: boolean;
        isDisabled?: boolean;
        isVisible?: boolean;
      }) => {
        if (isEnabled !== undefined) {
          await validateWorkEmailBtn.waitFor({ state: 'visible' });

          if (isEnabled) {
            await expect(validateWorkEmailBtn).toBeChecked();
          } else {
            await expect(validateWorkEmailBtn).not.toBeChecked();
          }
        }

        if (isDisabled !== undefined) {
          await validateWorkEmailBtn.waitFor({ state: 'visible' });

          if (isDisabled) {
            await expect(validateWorkEmailBtn).toBeDisabled();
          } else {
            await expect(validateWorkEmailBtn).not.toBeDisabled();
          }
        }

        if (isVisible !== undefined) {
          if (isVisible) {
            await expect(validateWorkEmailBtn).toBeVisible();
          } else {
            await expect(validateWorkEmailBtn).not.toBeVisible();
          }
        }
      },
    };
  }

  async getFormFieldErrors({ title }: { title: string }) {
    // ant-form-item-explain
    const field = this.get().locator(`[data-testid="nc-form-fields"][data-title="${title}"]`);
    await field.scrollIntoViewIfNeeded();
    const fieldErrorEl = field.locator('.ant-form-item-explain');

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

  async addLimitToRangeMinOrMax({ type, isMinValue, value }: { type: UITypes; isMinValue: boolean; value: string }) {
    const fieldLocator = this.get().getByTestId(`nc-limit-to-range-${isMinValue ? 'min' : 'max'}-${type}`);

    switch (type) {
      default: {
        await fieldLocator.locator('input:visible').waitFor();

        await this.waitForResponse({
          uiAction: async () => {
            await fieldLocator.locator(`input`).click();
            await fieldLocator.locator(`input`).fill(value);
            await this.rootPage.keyboard.press('Enter');
          },
          requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
          httpMethodsToMatch: ['PATCH'],
        });
      }
    }
  }

  async getFormFieldsValidateLimitToRange({ type }: { type: UITypes }) {
    const validateBtn = this.get().getByTestId(`nc-limit-to-range-${type}`);

    return {
      locator: validateBtn,
      click: async ({ enable, min, max }: { enable: boolean; min?: string; max?: string }) => {
        await validateBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateBtn.isChecked();

        if (enable && !isEnabled) {
          await validateBtn.click();
          await this.get().locator('.nc-limit-to-range-wrapper').first().waitFor({ state: 'visible' });

          if (min !== undefined) {
            await this.addLimitToRangeMinOrMax({ type, isMinValue: true, value: min });
          }

          if (max !== undefined) {
            await this.addLimitToRangeMinOrMax({ type, isMinValue: false, value: max });
          }
        } else if (!enable && isEnabled) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({
        isEnabled,
        isDisabled,
        isVisible,
      }: {
        isEnabled?: boolean;
        isDisabled?: boolean;
        isVisible?: boolean;
      }) => {
        if (isEnabled !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });

          if (isEnabled) {
            await expect(validateBtn).toBeChecked();
          } else {
            await expect(validateBtn).not.toBeChecked();
          }
        }

        if (isDisabled !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });

          if (isDisabled) {
            await expect(validateBtn).toBeDisabled();
          } else {
            await expect(validateBtn).not.toBeDisabled();
          }
        }

        if (isVisible !== undefined) {
          if (isVisible) {
            await expect(validateWorkEmailBtn).toBeVisible();
          } else {
            await expect(validateWorkEmailBtn).not.toBeVisible();
          }
        }
      },
    };
  }

  async getFormFieldsValidateAttFileType() {
    const validateBtn = this.get().getByTestId('nc-att-limit-file-type');
    const validationWrapper = this.get().locator('.nc-att-limit-file-type-wrapper');
    await validateBtn.scrollIntoViewIfNeeded();

    return {
      locator: validateBtn,
      click: async ({ enable, fillValue }: { enable: boolean; fillValue?: string }) => {
        await validateBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateBtn.isChecked();

        if (enable && !isEnabled) {
          await validateBtn.click();
        } else if (!enable && isEnabled) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
        if (enable && fillValue !== undefined) {
          await validationWrapper.locator('input').first().waitFor({ state: 'visible' });

          await this.waitForResponse({
            uiAction: async () => {
              await validationWrapper.locator('input').fill(fillValue);
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({ isEnabled, hasError }: { isEnabled?: boolean; hasError?: boolean }) => {
        if (isEnabled !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });

          if (isEnabled) {
            await expect(validateBtn).toBeChecked();
          } else {
            await expect(validateBtn).not.toBeChecked();
          }
        }

        if (hasError !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });
          await validationWrapper.waitFor({ state: 'visible' });

          if (hasError) {
            await expect(validationWrapper.locator('.validation-input-error')).toBeVisible();
          } else {
            await expect(validationWrapper.locator('.validation-input-error')).not.toBeVisible();
          }
        }
      },
    };
  }
  async getFormFieldsValidateAttFileCount() {
    const validateBtn = this.get().getByTestId('nc-att-limit-file-count');
    const validationWrapper = this.get().locator('.nc-att-limit-file-count-wrapper');
    await validateBtn.scrollIntoViewIfNeeded();

    return {
      locator: validateBtn,
      click: async ({ enable, fillValue }: { enable: boolean; fillValue?: string }) => {
        await validateBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateBtn.isChecked();

        if (enable && !isEnabled) {
          await validateBtn.click();
        } else if (!enable && isEnabled) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
        if (enable && fillValue !== undefined) {
          await validationWrapper.locator('input').first().waitFor({ state: 'visible' });

          await this.waitForResponse({
            uiAction: async () => {
              await validationWrapper.locator('input').fill(fillValue);
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({ isEnabled, hasError }: { isEnabled?: boolean; hasError?: boolean }) => {
        if (isEnabled !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });

          if (isEnabled) {
            await expect(validateBtn).toBeChecked();
          } else {
            await expect(validateBtn).not.toBeChecked();
          }
        }

        if (hasError !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });
          await validationWrapper.waitFor({ state: 'visible' });

          if (hasError) {
            await expect(validationWrapper.locator('.validation-input-error')).toBeVisible();
          } else {
            await expect(validationWrapper.locator('.validation-input-error')).not.toBeVisible();
          }
        }
      },
    };
  }
  async getFormFieldsValidateAttFileSize() {
    const validateBtn = this.get().getByTestId('nc-att-limit-file-size');
    const validationWrapper = this.get().locator('.nc-att-limit-file-size-wrapper');
    await validateBtn.scrollIntoViewIfNeeded();

    return {
      locator: validateBtn,
      click: async ({
        enable,
        fillValue,
        unit = 'KB',
      }: {
        enable: boolean;
        fillValue?: string;
        unit?: 'KB' | 'MB';
      }) => {
        await validateBtn.waitFor({ state: 'visible' });

        const isEnabled = await validateBtn.isChecked();

        if (enable && !isEnabled) {
          await validateBtn.click();
        } else if (!enable && isEnabled) {
          await this.waitForResponse({
            uiAction: async () => {
              await validateBtn.click();
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }

        if (enable && fillValue !== undefined) {
          await validationWrapper.locator('.nc-validation-input-wrapper input').first().waitFor({ state: 'visible' });

          await validationWrapper.locator('.ant-select-selector').click();
          const dropdown = this.rootPage.locator('.nc-att-limit-file-size-unit-selector-dropdown');
          await dropdown.waitFor({ state: 'visible' });
          const option = dropdown.locator('.ant-select-item-option').getByText(unit);
          await option.scrollIntoViewIfNeeded();
          await option.waitFor({ state: 'visible' });
          await option.click();

          await this.waitForResponse({
            uiAction: async () => {
              await validationWrapper.locator('.nc-validation-input-wrapper input').fill(fillValue);
            },
            requestUrlPathToMatch: '/api/v1/db/meta/form-columns',
            httpMethodsToMatch: ['PATCH'],
          });
        }
      },
      verify: async ({ isEnabled, hasError }: { isEnabled?: boolean; hasError?: boolean }) => {
        if (isEnabled !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });

          if (isEnabled) {
            await expect(validateBtn).toBeChecked();
          } else {
            await expect(validateBtn).not.toBeChecked();
          }
        }

        if (hasError !== undefined) {
          await validateBtn.waitFor({ state: 'visible' });
          await validationWrapper.waitFor({ state: 'visible' });

          if (hasError) {
            await expect(validationWrapper.locator('.validation-input-error')).toBeVisible();
          } else {
            await expect(validationWrapper.locator('.validation-input-error')).not.toBeVisible();
          }
        }
      },
    };
  }

  async verifyFieldConfigError({ title, hasError }: { title: string; hasError: boolean }) {
    const field = this.get().locator(`[data-testid="nc-form-fields"][data-title="${title}"]`);
    await field.scrollIntoViewIfNeeded();

    if (hasError) {
      await expect(field.locator('.nc-field-config-error')).toBeVisible();
    } else {
      await expect(field.locator('.nc-field-config-error')).not.toBeVisible();
    }
  }
}
