import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { Api, StringValidationType, UITypes } from 'nocodb-sdk';
import { LoginPage } from '../../../pages/LoginPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { enableQuickRun, isEE } from '../../../setup/db';

// todo: Move most of the ui actions to page object and await on the api response
test.describe('Form view', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let form: FormPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    form = dashboard.form;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Field re-order operations', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 0 });

    // verify form-view fields order
    await form.verifyFormViewFieldsOrder({
      fields: ['Country', 'LastUpdate', 'Cities'],
    });

    // reorder & verify
    await form.reorderFields({
      sourceField: 'LastUpdate',
      destinationField: 'Country',
    });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'Cities'],
    });

    // remove & verify (hide field button)
    await form.removeField({ field: 'Cities', mode: 'hideField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (hide field button)
    await form.addField({ field: 'Cities', mode: 'clickField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'Cities'],
    });

    // remove-all & verify
    await form.removeAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyFormViewFieldsOrder({
      fields: ['Country'],
    });

    // // add-all & verify
    await form.addAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'Cities'],
    });
  });

  test('Form elements validation', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 0 });

    await form.configureHeader({
      title: 'Country',
      subtitle: 'Country subtitle',
    });
    await form.verifyHeader({
      title: 'Country',
      subtitle: 'Country subtitle',
    });

    // configure field title & description
    await form.configureField({
      field: 'Country',
      label: 'Country new title',
      helpText: 'Country new description',
      required: true,
    });
    await form.verifyFormFieldLabel({
      index: 0,
      label: 'Country new title',
    });
    await form.verifyFormFieldHelpText({
      index: 0,
      helpText: 'Country new description',
    });

    // revert configurations
    await form.configureField({
      field: 'Country',
      label: 'Country',
      helpText: '',
      required: true,
    });

    // retain only 'Country' field
    await form.removeAllFields();

    // submit default form validation
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Successfully submitted form data',
    });

    // submit custom form validation
    await form.submitAnotherForm().waitFor();
    await form.submitAnotherForm().click();

    await form.configureSubmitMessage({
      message: 'Custom submit message',
    });
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Custom submit message',
    });

    // enable 'submit another form' option
    await form.submitAnotherForm().waitFor();
    await form.submitAnotherForm().click();

    await form.showAnotherFormRadioButton.click();
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyStatePostSubmit({
      submitAnotherForm: true,
    });
    await form.submitAnotherForm().click();

    // enable 'show another form' option
    await form.showAnotherFormRadioButton.click();
    await form.showAnotherFormAfter5SecRadioButton.click();
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await dashboard.rootPage.waitForTimeout(6000);
    await form.verifyStatePostSubmit({
      showBlankForm: true,
    });

    // enable 'email-me' option
    await form.showAnotherFormAfter5SecRadioButton.click();
    await form.emailMeRadioButton.click();
    await dashboard.verifyToast({
      message: 'Please activate SMTP plugin in App store for enabling email notification',
    });
    // const url = dashboard.rootPage.url();

    // activate SMTP plugin
    // await accountAppStorePage.goto();
    //
    // // install SMTP
    // await accountAppStorePage.install({ name: 'SMTP' });
    // await accountAppStorePage.configureSMTP({
    //   email: 'a@b.com',
    //   host: 'smtp.gmail.com',
    //   port: '587',
    // });
    // await dashboard.verifyToast({
    //   message: 'Successfully installed and email notification will use SMTP configuration',
    // });
    //
    // // revisit form view
    // await page.goto(url);
    //
    // // enable 'email-me' option
    // await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    // await form.emailMeRadioButton.click();
    // await form.verifyAfterSubmitMenuState({
    //   emailMe: true,
    //   submitAnotherForm: false,
    //   showBlankForm: false,
    // });
    //
    // // Uninstall SMTP
    // await accountAppStorePage.goto();
    // await accountAppStorePage.uninstall({ name: 'SMTP' });
    //
    // await dashboard.verifyToast({
    //   message: 'Plugin uninstalled successfully',
    // });
  });

  test('Form share, verify attachment file', async () => {
    await dashboard.treeView.createTable({ title: 'New', baseTitle: context.base.title });

    await dashboard.grid.column.create({
      title: 'Attachment',
      type: 'Attachment',
    });

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: [`${process.cwd()}/fixtures/sampleFiles/sampleImage.jpeg`],
    });
    await sharedForm.cell.fillText({
      columnHeader: 'Title',
      text: 'Text',
    });

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
  });
});

test.describe('Form view with LTAR', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let loginPage: LoginPage;
  let context: any;
  let api: Api<any>;

  let cityTable: any, countryTable: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    loginPage = new LoginPage(page);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const cityColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'City',
        title: 'City',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];
    const countryColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Country',
        title: 'Country',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      cityTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'Country',
        title: 'Country',
        columns: countryColumns,
      });

      const cityRowAttributes = [{ City: 'Atlanta' }, { City: 'Pune' }, { City: 'London' }, { City: 'Sydney' }];
      await api.dbTableRow.bulkCreate('noco', context.base.id, cityTable.id, cityRowAttributes);

      const countryRowAttributes = [{ Country: 'India' }, { Country: 'UK' }, { Country: 'Australia' }];
      await api.dbTableRow.bulkCreate('noco', context.base.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityList',
        title: 'CityList',
        uidt: UITypes.Links,
        parentId: countryTable.id,
        childId: cityTable.id,
        type: 'hm',
      });

      // await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.id, '1', 'hm', 'CityList', '1');
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Form view with LTAR', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Country' });

    const url = dashboard.rootPage.url();

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
    const formUrl = await dashboard.form.topbar.getSharedViewUrl();
    console.log(formUrl);

    // sign-out
    await dashboard.signOut();
    await page.goto(formUrl);
    await page.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.fillText({
      columnHeader: 'Country',
      text: 'USA',
    });
    await sharedForm.clickLinkToChildList();

    await new Promise(r => setTimeout(r, 500));

    await sharedForm.verifyChildList(['Atlanta', 'Pune', 'London', 'Sydney']);
    await sharedForm.selectChildList('Atlanta');
    await sharedForm.closeLinkToChildList();

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await page.goto(url);
    await page.reload();
    await loginPage.signIn({
      email: `user-${process.env.TEST_PARALLEL_INDEX}@nocodb.com`,
      password: getDefaultPwd(),
      withoutPrefix: true,
    });

    if (isEE()) {
      await dashboard.rootPage.waitForTimeout(500);
      await dashboard.leftSidebar.openWorkspace({ title: context.workspace.title });
      await dashboard.rootPage.waitForTimeout(500);
    }
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.cell.verify({
      index: 3,
      columnHeader: 'Country',
      value: 'USA',
    });
    await dashboard.grid.cell.verifyVirtualCell({
      index: 3,
      columnHeader: 'CityList',
      count: 1,
      type: 'hm',
      options: { singular: 'City', plural: 'Cities' },
    });
  });
});

test.describe('Form view', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Select fields in form view', async () => {
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'SingleSelect',
        title: 'SingleSelect',
        uidt: UITypes.SingleSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
      {
        column_name: 'MultiSelect',
        title: 'MultiSelect',
        uidt: UITypes.MultiSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
    ];

    const base = await api.base.read(context.base.id);
    await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: 'selectBased',
      title: 'selectBased',
      columns: columns,
    });

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(100);

    await dashboard.treeView.openTable({ title: 'selectBased' });
    const url = dashboard.rootPage.url();

    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);

    // Click on single select options
    await sharedForm.cell.selectOption.select({
      index: -1,
      columnHeader: 'SingleSelect',
      option: 'jan',
      multiSelect: false,
      ignoreDblClick: true,
    });

    // Click on multi select options
    const multiSelectParams = {
      index: -1,
      columnHeader: 'MultiSelect',
      option: 'jan',
      multiSelect: true,
      ignoreDblClick: true,
    };
    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'jan' });
    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'feb' });
    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'mar' });

    await sharedForm.submit();

    await dashboard.rootPage.goto(url);
    // kludge- reload
    await dashboard.rootPage.reload();

    await dashboard.treeView.openTable({ title: 'selectBased' });

    await dashboard.rootPage.waitForTimeout(2000);

    await dashboard.grid.cell.selectOption.verify({
      columnHeader: 'SingleSelect',
      option: 'jan',
      multiSelect: false,
    });

    await dashboard.grid.cell.selectOption.verifySelectedOptions({
      index: 0,
      columnHeader: 'MultiSelect',
      options: ['jan', 'feb', 'mar'],
    });
  });
});

test.describe('Form view: field validation', () => {
  if (enableQuickRun() || !isEE()) test.skip();

  let dashboard: DashboardPage;
  let form: FormPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    form = dashboard.form;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function createTable({ tableName }: { tableName: string }) {
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'SingleLineText',
        title: 'SingleLineText',
        uidt: UITypes.SingleLineText,
      },
      {
        column_name: 'LongText',
        title: 'LongText',
        uidt: UITypes.LongText,
      },
      {
        column_name: 'Email',
        title: 'Email',
        uidt: UITypes.Email,
      },
      {
        column_name: 'PhoneNumber',
        title: 'PhoneNumber',
        uidt: UITypes.PhoneNumber,
        meta: {
          validate: true,
        },
      },
      {
        column_name: 'Url',
        title: 'Url',
        uidt: UITypes.URL,
      },
    ];

    const base = await api.base.read(context.base.id);
    await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: tableName,
      title: tableName,
      columns: columns,
    });

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(100);

    await dashboard.treeView.openTable({ title: tableName });

    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
  }

  test('Form builder field validation', async () => {
    await createTable({ tableName: 'FormFieldValidation' });
    await form.configureHeader({
      title: 'Form validation',
      subtitle: 'Test form field validation',
    });
    await form.verifyHeader({
      title: 'Form validation',
      subtitle: 'Test form field validation',
    });

    // 1.
    await form.selectVisibleField({ title: 'SingleLineText' });

    await form.addCustomValidation({ type: StringValidationType.MinLength, value: '2', index: 0 });
    await form.addCustomValidation({ type: StringValidationType.MaxLength, value: '4', index: 1 });

    // Verify already used selector is disable
    await form.verifyCustomValidationSelector({ type: StringValidationType.MinLength, index: 1 });

    // verify count
    await form.verifyCustomValidationCount({ count: 2 });
    // remove validation item
    await form.removeCustomValidationItem({ index: 1 });

    await form.verifyCustomValidationCount({ count: 1 });

    await form.addCustomValidation({ type: StringValidationType.MaxLength, value: '4', index: 1 });

    await form.verifyCustomValidationCount({ count: 2 });
    // verify incomplete validator
    await form.updateCustomValidation({ value: '', index: 1 });
    await form.verifyCustomValidationCount({ count: 1 });
    await form.verifyCustomValidationValue({ hasError: true, index: 1 });

    await form.updateCustomValidation({ value: '1', index: 1 });

    // Max value should be greater than min value
    await form.verifyCustomValidationValue({ hasError: true, index: 1 });

    await form.updateCustomValidation({ value: '15', index: 1 });

    await form.addCustomValidation({
      type: StringValidationType.StartsWith,
      value: 'Lorem Ipsum is simply dummy text',
      index: 2,
    });

    // max value is set to 12 charactors and startsWidth, endsWith, includes, notIncludes value must not be greater than maxLength
    await form.verifyCustomValidationValue({ hasError: true, index: 2 });
    await form.updateCustomValidation({ value: 'lorem', index: 2 });

    await form.addCustomValidation({ type: StringValidationType.EndsWith, value: 'ipsum', index: 3 });

    await form.addCustomValidation({ type: StringValidationType.Includes, value: 'lorem', index: 4 });
    await form.addCustomValidation({ type: StringValidationType.NotIncludes, value: 'lorem', index: 5 });

    // Includes and not includes value should be different
    await form.verifyCustomValidationValue({ hasError: true, index: 5 });
    await form.updateCustomValidation({ value: 'singleLineText', index: 5 });

    const singleLineTextErrorConfig = await form.getFormFieldErrors({ title: 'SingleLineText' });

    const validatorFillDetails = [
      {
        fillValue: 's',
        errors: [
          /The input must be at least 2 characters long/i,
          /The input must start with 'lorem'/i,
          /The input must end with 'ipsum'./i,
          /The input must contain the string 'lorem'./i,
        ],
      },
      {
        fillValue: 'lorem',
        errors: [/The input must end with 'ipsum'./i],
      },
      {
        fillValue: 'lorem ipsum x',
        errors: [/The input must end with 'ipsum'./i],
      },
      {
        fillValue: 'lorem ipsum',
        errors: [],
      },
      {
        fillValue: 'lorem ipsum ipsum ipsum',
        errors: [/The input must not exceed 15 characters/i],
      },
      {
        fillValue: 'lorem ipsum',
        errors: [],
      },
    ];

    for (const formField of validatorFillDetails) {
      await form.fillForm([{ field: 'SingleLineText', value: formField.fillValue }]);
      await singleLineTextErrorConfig.verify({ hasError: !!formField.errors.length });
      for (const error of formField.errors) {
        await singleLineTextErrorConfig.verify({ hasErrorMsg: error });
      }
    }

    // 2. Long text
    await form.selectVisibleField({ title: 'LongText' });

    // Regex
    await form.addCustomValidation({ type: StringValidationType.Regex, value: '(ipsumf', index: 0 });

    // verify invalid regex: `(` is invalid charactor
    await form.verifyCustomValidationValue({ hasError: true, index: 0 });
    await form.updateCustomValidation({ value: 'ipsum', index: 0 });
    await form.verifyCustomValidationValue({ hasError: false, index: 0 });

    const longTextErrorConfig = await form.getFormFieldErrors({ title: 'LongText' });

    await form.fillForm([{ field: 'LongText', value: 'lorem', type: UITypes.LongText }]);
    await longTextErrorConfig.verify({ hasErrorMsg: /The input does not match the required format/i });
    await form.fillForm([{ field: 'LongText', value: 'ipsum', type: UITypes.LongText }]);
    await longTextErrorConfig.verify({ hasError: false });

    // 3. Email
    await form.selectVisibleField({ title: 'Email' });
    const { click, verify } = await form.getFormFieldsEmailPhoneUrlValidatorConfig({
      type: UITypes.Email,
    });

    const { click: _clickWorkEmail, verify: verifyWorkEmail } = await form.getFormFieldsValidateWorkEmailConfig();

    // Work email validate switch is only visible if email valiator is enabled
    await verifyWorkEmail({ isVisible: false });
    await click({ enable: true });
    await verifyWorkEmail({ isVisible: true });

    await dashboard.rootPage.reload();
    await form.selectVisibleField({ title: 'Email' });

    await verify({ isEnabled: true });

    // Verify regular email
    await form.fillForm([{ field: 'Email', value: 'john@gmail.com' }]);
    const emailErrorConfig = await form.getFormFieldErrors({ title: 'Email' });
    await emailErrorConfig.verify({ hasError: false });

    await form.fillForm([{ field: 'Email', value: 'john@gmail.com.' }]);
    await emailErrorConfig.verify({ hasErrorMsg: /Invalid Email/i });

    // Enable accept only work email & verify
    await _clickWorkEmail({ enable: true });
    await form.fillForm([{ field: 'Email', value: 'john@gmail.com' }]);

    await emailErrorConfig.verify({ hasErrorMsg: /Invalid Work Email/i });
    await form.fillForm([{ field: 'Email', value: 'john@nocodb.com' }]);
    await emailErrorConfig.verify({ hasError: false });

    // 4. Phone Number
    await form.selectVisibleField({ title: 'PhoneNumber' });
    const { click: _click, verify: verifyPhoneNumber } = await form.getFormFieldsEmailPhoneUrlValidatorConfig({
      type: UITypes.PhoneNumber,
    });

    const phoneNumberErrorConfig = await form.getFormFieldErrors({ title: 'PhoneNumber' });

    // Validation infored by field schema settings
    await verifyPhoneNumber({ isEnabled: true, isDisabled: true });
    await form.addCustomValidation({ type: StringValidationType.MinLength, value: '10', index: 0 });
    await form.fillForm([{ field: 'PhoneNumber', value: '12345' }]);
    await phoneNumberErrorConfig.verify({ hasErrorMsg: /Invalid phone number/i });
    await phoneNumberErrorConfig.verify({ hasErrorMsg: /The input must be at least 10 characters long/i });
    await form.fillForm([{ field: 'PhoneNumber', value: '1234567890' }]);
    await phoneNumberErrorConfig.verify({ hasError: false });

    await dashboard.rootPage.waitForTimeout(5000);
  });
});
