import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { Api, StringValidationType, UITypes } from 'nocodb-sdk';
import { LoginPage } from '../../../pages/LoginPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { enableQuickRun, isEE } from '../../../setup/db';
import { SurveyFormPage } from '../../../pages/Dashboard/SurveyForm';

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
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/sampleImage.jpeg`],
      skipElemClick: true,
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
      baseURL: 'http://localhost:8080/',
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
      baseURL: 'http://localhost:8080/',
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

  async function createTable({ tableName, type }: { tableName: string; type?: 'limitToRange' | 'attachment' }) {
    api = new Api({
      baseURL: 'http://localhost:8080/',
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
      ...(type === 'limitToRange'
        ? [
            {
              column_name: 'Date',
              title: 'Date',
              uidt: 'Date',
              meta: {
                date_format: 'YYYY-MM-DD',
              },
            },
            {
              column_name: 'Time',
              title: 'Time',
              uidt: 'Time',
            },
            {
              column_name: 'Year',
              title: 'Year',
              uidt: 'Year',
            },
            {
              column_name: 'SingleSelect',
              title: 'SingleSelect',
              uidt: 'SingleSelect',
              dtxp: "'jan','feb', 'mar','apr', 'may','jun','jul','aug','sep','oct','nov','dec'",
            },
            {
              column_name: 'MultiSelect',
              title: 'MultiSelect',
              uidt: 'MultiSelect',
              dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
            },
            {
              column_name: 'Number',
              title: 'Number',
              uidt: 'Number',
            },
            {
              column_name: 'Decimal',
              title: 'Decimal',
              uidt: 'Decimal',
            },
            {
              column_name: 'Currency',
              title: 'Currency',
              uidt: 'Currency',
              meta: {
                currency_locale: 'en-GB',
                currency_code: 'UGX',
              },
            },
            {
              column_name: 'Percent',
              title: 'Percent',
              uidt: 'Percent',
            },
            {
              column_name: 'Duration',
              title: 'Duration',
              uidt: 'Duration',
              meta: {
                duration: 0,
              },
            },
          ]
        : type === 'attachment'
        ? [
            {
              column_name: 'Attachment',
              title: 'Attachment',
              uidt: UITypes.Attachment,
            },
          ]
        : [
            {
              column_name: 'SingleLine.Text',
              title: 'SingleLine.Text',
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
          ]),
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

    const url = dashboard.rootPage.url();

    await form.configureHeader({
      title: 'Form validation',
      subtitle: 'Test form field validation',
    });
    await form.verifyHeader({
      title: 'Form validation',
      subtitle: 'Test form field validation',
    });

    // 1.
    await form.selectVisibleField({ title: 'SingleLine.Text' });

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

    // 2. Long text
    await form.selectVisibleField({ title: 'LongText' });
    // Regex
    await form.addCustomValidation({ type: StringValidationType.Regex, value: '(ipsumf', index: 0 });

    // verify invalid regex: `(` is invalid charactor
    await form.verifyCustomValidationValue({ hasError: true, index: 0 });
    await form.updateCustomValidation({ value: 'ipsum', index: 0 });
    await form.verifyCustomValidationValue({ hasError: false, index: 0 });

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
    const { verify: verifyPhoneNumber } = await form.getFormFieldsEmailPhoneUrlValidatorConfig({
      type: UITypes.PhoneNumber,
    });

    // Validation infored by field schema settings
    await verifyPhoneNumber({ isEnabled: true, isDisabled: true });
    await form.addCustomValidation({ type: StringValidationType.MinLength, value: '10', index: 0 });

    // 4. URL
    await form.selectVisibleField({ title: 'Url' });

    // Validation infored by field schema settings
    await form.addCustomValidation({ type: StringValidationType.StartsWith, value: 'https://', index: 0 });

    const validatorFillDetails = {
      'SingleLine.Text': [
        {
          type: UITypes.SingleLineText,
          fillValue: 's',
          errors: [
            /The input must be at least 2 characters long/i,
            /The input must start with 'lorem'/i,
            /The input must end with 'ipsum'./i,
            /The input must contain the string 'lorem'./i,
          ],
        },
        {
          type: UITypes.SingleLineText,
          fillValue: 'lorem',
          errors: [/The input must end with 'ipsum'./i],
        },
        {
          type: UITypes.SingleLineText,
          fillValue: 'lorem ipsum x',
          errors: [/The input must end with 'ipsum'./i],
        },
        {
          type: UITypes.SingleLineText,
          fillValue: 'lorem ipsum',
          errors: [],
        },
        {
          type: UITypes.SingleLineText,
          fillValue: 'lorem ipsum ipsum ipsum',
          errors: [/The input must not exceed 15 characters/i],
        },
        {
          type: UITypes.SingleLineText,
          fillValue: 'lorem ipsum',
          errors: [],
        },
      ],
      LongText: [
        {
          type: UITypes.LongText,
          fillValue: 'lorem',
          errors: [/The input does not match the required format/i],
        },
        {
          type: UITypes.LongText,
          fillValue: 'ipsum',
          errors: [],
        },
      ],
      Email: [
        {
          type: UITypes.Email,
          fillValue: 'john@gmail.com',
          errors: [/Invalid Work Email/i],
        },
        {
          type: UITypes.Email,
          fillValue: 'john@gmail.com.',
          errors: [/Invalid Email/i, /Invalid Work Email/i],
        },
        {
          type: UITypes.Email,
          fillValue: 'john@nocodb.com',
          errors: [],
        },
      ],
      PhoneNumber: [
        {
          type: UITypes.PhoneNumber,
          fillValue: '12345',
          errors: [/Invalid phone number/i, /The input must be at least 10 characters long/i],
        },
        {
          type: UITypes.PhoneNumber,
          fillValue: '1234567890',
          errors: [],
        },
      ],
      Url: [
        {
          type: UITypes.URL,
          fillValue: 'google.com',
          errors: [/The input must start with 'https:\/\/'/i],
        },
        {
          type: UITypes.URL,
          fillValue: 'https://google.com',
          errors: [],
        },
      ],
    };

    for (const formField in validatorFillDetails) {
      const fielConfigError = await form.getFormFieldErrors({ title: formField });

      for (const fieldValue of validatorFillDetails[formField]) {
        await form.fillForm([{ field: formField, value: fieldValue.fillValue, type: fieldValue.type }]);
        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
    }

    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Successfully submitted form data',
    });

    await dashboard.rootPage.reload();

    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);

    for (const formField in validatorFillDetails) {
      const fielConfigError = await sharedForm.getFormFieldErrors({ title: formField });

      for (const fieldValue of validatorFillDetails[formField]) {
        await sharedForm.cell.fillText({
          columnHeader: formField,
          text: fieldValue.fillValue,
          type: fieldValue.type,
        });
        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
    }

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await dashboard.rootPage.goto(url);
    // kludge- reload
    await dashboard.rootPage.reload();

    await dashboard.form.topbar.clickShare();
    await dashboard.form.topbar.share.clickShareViewPublicAccess();
    await dashboard.form.topbar.share.closeModal();

    const surveyLink = await dashboard.form.topbar.getSharedViewUrl(true);
    await dashboard.rootPage.reload();
    await dashboard.form.configureSubmitMessage({
      message: 'Thank you for submitting the form',
    });

    // wait to ensure configured message is saved
    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.rootPage.goto(surveyLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    const surveyForm = new SurveyFormPage(dashboard.rootPage);

    await surveyForm.clickFillForm();

    for (const formField in validatorFillDetails) {
      const fielConfigError = await surveyForm.getFormFieldErrors();

      for (const fieldValue of validatorFillDetails[formField]) {
        await surveyForm.fill({
          fieldLabel: formField,
          value: fieldValue.fillValue,
          type: fieldValue.type,
          skipNavigation: true,
        });
        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
      if (formField !== 'Url') {
        await surveyForm.nextButton.click();
      }
    }

    await surveyForm.confirmAndSubmit();

    // validate post submit data
    await surveyForm.validateSuccessMessage({
      message: 'Thank you for submitting the form',
      isCustomMsg: true,
    });
  });

  test('Form builder field validation: limit to range', async () => {
    test.slow();
    await createTable({ tableName: 'FormFieldLimitToRange', type: 'limitToRange' });
    const url = dashboard.rootPage.url();

    await form.configureHeader({
      title: 'Limit to range validation',
      subtitle: 'Test form field validation',
    });
    await form.verifyHeader({
      title: 'Limit to range validation',
      subtitle: 'Test form field validation',
    });

    const limitToRageData = [
      {
        type: UITypes.Date,
        title: 'Date',
        min: '2023-07-17',
        max: '2025-07-17',
      },
      {
        type: UITypes.Time,
        title: 'Time',
        min: '01:20',
        max: '12:30',
      },
      {
        type: UITypes.Year,
        title: 'Year',
        min: '2000',
        max: '2024',
      },
      {
        type: UITypes.MultiSelect,
        title: 'MultiSelect',
        min: '2',
        max: '3',
      },
      {
        type: UITypes.Number,
        title: 'Number',
        min: '1',
        max: '6',
      },
      {
        type: UITypes.Decimal,
        title: 'Decimal',
        min: '1.5',
        max: '10.58',
      },
      {
        type: UITypes.Currency,
        title: 'Currency',
        min: '100',
        max: '200',
      },
      {
        type: UITypes.Percent,
        title: 'Percent',
        uidt: 'Percent',
        min: '99',
        max: '120',
      },
      {
        type: UITypes.Duration,
        title: 'Duration',
        min: '1:5',
        max: '10:58',
      },
    ];

    for (const limit of limitToRageData) {
      await form.selectVisibleField({ title: limit.title });
      const validateRange = await form.getFormFieldsValidateLimitToRange({ type: limit.type as UITypes });
      await validateRange.click({ enable: true, min: limit.min, max: limit.max });
    }

    const limitToRageFillValue = {
      Date: [
        {
          type: UITypes.Date,
          fillValue: '2023-07-12',
          errors: [/Select a date on or after 2023-07-17/i],
        },
        {
          type: UITypes.Date,
          fillValue: '2026-07-17',
          errors: [/Select a date on or before 2025-07-17/i],
        },
        {
          type: UITypes.Date,
          fillValue: '2024-07-17',
          errors: [],
        },
      ],
      Time: [
        {
          type: UITypes.Time,
          fillValue: '01:10',
          errors: [/Input a time equal to or later than 01:20/i],
        },
        {
          type: UITypes.Time,
          fillValue: '14:30',
          errors: [/Input a time equal to or earlier than 12:30/i],
        },
        {
          type: UITypes.Time,
          fillValue: '12:30',
          errors: [],
        },
      ],
      Year: [
        {
          type: UITypes.Year,
          fillValue: '1999',
          errors: [/Input a year equal to or later than 2000/i],
        },
        {
          type: UITypes.Year,
          fillValue: '2025',
          errors: [/Input a year equal to or earlier than 2024/i],
        },
        {
          type: UITypes.Year,
          fillValue: '2000',
          errors: [],
        },
      ],
      Number: [
        {
          type: UITypes.Number,
          fillValue: '0',
          errors: [/Input a number equal to or greater than 1/i],
        },
        {
          type: UITypes.Number,
          fillValue: '7',
          errors: [/Input a number equal to or less than 6/i],
        },
        {
          type: UITypes.Number,
          fillValue: '6',
          errors: [],
        },
      ],
      Decimal: [
        {
          type: UITypes.Decimal,
          fillValue: '1.00',
          errors: [/Input a number equal to or greater than 1.5/i],
        },
        {
          type: UITypes.Decimal,
          fillValue: '11.29',
          errors: [/Input a number equal to or less than 10.58/i],
        },
        {
          type: UITypes.Decimal,
          fillValue: '10.2',
          errors: [],
        },
      ],
      Currency: [
        {
          type: UITypes.Currency,
          fillValue: '88',
          errors: [/Input a number equal to or greater than 100/i],
        },
        {
          type: UITypes.Currency,
          fillValue: '2012',
          errors: [/Input a number equal to or less than 200/i],
        },
        {
          type: UITypes.Currency,
          fillValue: '150',
          errors: [],
        },
      ],
      Percent: [
        {
          type: UITypes.Percent,
          fillValue: '88',
          errors: [/Input a number equal to or greater than 99/i],
        },
        {
          type: UITypes.Percent,
          fillValue: '2012',
          errors: [/Input a number equal to or less than 120/i],
        },
        {
          type: UITypes.Percent,
          fillValue: '110',
          errors: [],
        },
      ],
      Duration: [
        {
          type: UITypes.Duration,
          fillValue: '1:00',
          errors: [/Input a duration equal to or later than 01:05/i],
        },
        {
          type: UITypes.Duration,
          fillValue: '11:29',
          errors: [/Input a duration equal to or earlier than 10:58/i],
        },
        {
          type: UITypes.Duration,
          fillValue: '10:2',
          errors: [],
        },
      ],
    };

    for (const formField in limitToRageFillValue) {
      const fielConfigError = await form.getFormFieldErrors({ title: formField });

      for (const fieldValue of limitToRageFillValue[formField]) {
        await form.fillForm([{ field: formField, value: fieldValue.fillValue, type: fieldValue.type }]);

        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
    }

    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Successfully submitted form data',
    });

    await dashboard.rootPage.reload();

    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);

    for (const formField in limitToRageFillValue) {
      const fielConfigError = await sharedForm.getFormFieldErrors({ title: formField });

      for (const fieldValue of limitToRageFillValue[formField]) {
        await sharedForm.cell.fillText({
          columnHeader: formField,
          text: fieldValue.fillValue,
          type: fieldValue.type,
        });
        await sharedForm.fieldLabel({ title: formField }).click();

        await dashboard.rootPage.waitForTimeout(100);

        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
    }

    const multiSelectFieldError = await sharedForm.getFormFieldErrors({ title: 'MultiSelect' });

    // Click on multi select options
    const multiSelectParams = {
      index: -1,
      columnHeader: 'MultiSelect',
      option: 'jan',
      multiSelect: true,
      ignoreDblClick: true,
    };
    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'jan' });

    await multiSelectFieldError.verify({ hasErrorMsg: /Please select at least 2 options/ });

    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'feb' });
    await sharedForm.cell.selectOption.select({ ...multiSelectParams, option: 'mar' });
    await multiSelectFieldError.verify({ hasError: false });

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await dashboard.rootPage.goto(url);
    // kludge- reload
    await dashboard.rootPage.reload();

    await dashboard.form.topbar.clickShare();
    await dashboard.form.topbar.share.clickShareViewPublicAccess();
    await dashboard.form.topbar.share.closeModal();

    const surveyLink = await dashboard.form.topbar.getSharedViewUrl(true);
    await dashboard.rootPage.reload();
    await dashboard.form.configureSubmitMessage({
      message: 'Thank you for submitting the form',
    });

    await form.removeField({ field: 'SingleSelect', mode: 'hideField' });
    await form.removeField({ field: 'MultiSelect', mode: 'hideField' });

    await dashboard.rootPage.goto(surveyLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    const surveyForm = new SurveyFormPage(dashboard.rootPage);

    await surveyForm.clickFillForm();

    for (const formField in limitToRageFillValue) {
      const fielConfigError = await surveyForm.getFormFieldErrors();
      for (const fieldValue of limitToRageFillValue[formField]) {
        await surveyForm.fill({
          fieldLabel: formField,
          value: fieldValue.fillValue,
          type: fieldValue.type,
          skipNavigation: true,
        });
        await fielConfigError.verify({ hasError: !!fieldValue.errors.length });
        for (const error of fieldValue.errors) {
          await fielConfigError.verify({ hasErrorMsg: error });
        }
      }
      if (formField !== 'Duration') {
        await surveyForm.nextButton.click();
      }
    }

    await surveyForm.confirmAndSubmit();

    // validate post submit data
    await surveyForm.validateSuccessMessage({
      message: 'Thank you for submitting the form',
      isCustomMsg: true,
    });
  });

  test('Form builder field validation: attachment', async () => {
    await createTable({ tableName: 'FormFieldAttachment', type: 'attachment' });

    const url = dashboard.rootPage.url();

    await form.configureHeader({
      title: 'Attachment validation',
      subtitle: 'Test form field validation',
    });
    await form.verifyHeader({
      title: 'Attachment validation',
      subtitle: 'Test form field validation',
    });

    await form.selectVisibleField({ title: 'Attachment' });

    const validateAttType = await form.getFormFieldsValidateAttFileType();
    await validateAttType.click({ enable: true, fillValue: '.jpg' });
    await validateAttType.verify({ hasError: true });
    await validateAttType.click({ enable: true, fillValue: 'image/png' });
    await validateAttType.verify({ hasError: false });

    const validateAttCount = await form.getFormFieldsValidateAttFileCount();
    await validateAttCount.click({ enable: true, fillValue: '1a' });
    await validateAttCount.verify({ hasError: true });
    await validateAttCount.click({ enable: true, fillValue: '1' });
    await validateAttCount.verify({ hasError: false });

    const validateAttSize = await form.getFormFieldsValidateAttFileSize();
    await validateAttSize.click({ enable: true, fillValue: '2000', unit: 'KB' });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/sampleImage.jpeg`],
      skipElemClick: true,
    });

    const attError = await sharedForm.getFormFieldErrors({ title: 'Attachment' });
    await attError.verify({ hasErrorMsg: /Only following file types allowed to upload 'image\/png'/ });
    await attError.verify({ hasErrorMsg: /The file size must not exceed 2000 KB/ });

    await sharedForm.cell.attachment.removeFile({
      columnHeader: 'Attachment',
      attIndex: 0,
      skipElemClick: true,
    });

    await sharedForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/Image/2.png`],
      skipElemClick: true,
    });
    await attError.verify({ hasError: false });

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await dashboard.rootPage.goto(url);
    // kludge- reload
    await dashboard.rootPage.reload();

    await dashboard.form.topbar.clickShare();
    await dashboard.form.topbar.share.clickShareViewPublicAccess();
    await dashboard.form.topbar.share.closeModal();

    const surveyLink = await dashboard.form.topbar.getSharedViewUrl(true);
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.form.configureSubmitMessage({
      message: 'Thank you for submitting the form',
    });

    await dashboard.rootPage.goto(surveyLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    const surveyForm = new SurveyFormPage(dashboard.rootPage);

    await surveyForm.clickFillForm();

    await surveyForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/sampleImage.jpeg`],
      skipElemClick: true,
    });

    const surveryAttError = await surveyForm.getFormFieldErrors();
    await surveryAttError.verify({ hasErrorMsg: /Only following file types allowed to upload 'image\/png'/ });
    await surveryAttError.verify({ hasErrorMsg: /The file size must not exceed 2000 KB/ });

    await surveyForm.cell.attachment.removeFile({
      columnHeader: 'Attachment',
      attIndex: 0,
      skipElemClick: true,
    });

    await surveyForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/Image/2.png`],
      skipElemClick: true,
    });
    await surveryAttError.verify({ hasError: false });

    await surveyForm.confirmAndSubmit();

    // validate post submit data
    await surveyForm.validateSuccessMessage({
      message: 'Thank you for submitting the form',
      isCustomMsg: true,
    });
  });
});

test.describe('Form view: conditional fields', () => {
  if (enableQuickRun()) test.skip();

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

  async function createTable({ tableName }: { tableName: string; type?: 'limitToRange' | 'attachment' }) {
    api = new Api({
      baseURL: 'http://localhost:8080/',
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
        column_name: 'Text',
        title: 'Text',
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
        column_name: 'SingleSelect',
        title: 'SingleSelect',
        uidt: 'SingleSelect',
        dtxp: "'jan','feb', 'mar','apr', 'may','jun','jul','aug','sep','oct','nov','dec'",
      },
      {
        column_name: 'MultiSelect',
        title: 'MultiSelect',
        uidt: 'MultiSelect',
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
      {
        column_name: 'Number',
        title: 'Number',
        uidt: 'Number',
      },
      {
        column_name: 'Decimal',
        title: 'Decimal',
        uidt: 'Decimal',
      },
      {
        column_name: 'Currency',
        title: 'Currency',
        uidt: 'Currency',
        meta: {
          currency_locale: 'en-GB',
          currency_code: 'UGX',
        },
      },
      {
        column_name: 'Percent',
        title: 'Percent',
        uidt: 'Percent',
      },
      {
        column_name: 'Duration',
        title: 'Duration',
        uidt: 'Duration',
        meta: {
          duration: 0,
        },
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

  test('Form builder conditional field', async () => {
    await createTable({ tableName: 'FormConditionalFields' });

    const url = dashboard.rootPage.url();

    await form.configureHeader({
      title: 'Form conditional fields',
      subtitle: 'Test form conditional fields',
    });
    await form.verifyHeader({
      title: 'Form conditional fields',
      subtitle: 'Test form conditional fields',
    });

    // 1. Verify first field conditions btn is disabled: we can't add conditions on first form field
    await form.selectVisibleField({ title: 'Text' });

    await form.conditionalFields.verify({ isDisabled: true });

    await form.selectVisibleField({ title: 'Decimal' });

    const fieldConditionsList = [
      { column: 'Text', op: 'is equal', value: 'Spain', dataType: UITypes.SingleLineText },
      { column: 'Email', op: 'is not equal', value: 'user@nocodb.com', dataType: UITypes.Email },
      { column: 'Number', op: '=', value: '22', dataType: UITypes.Number },
    ];

    await form.conditionalFields.click();

    for (let i = 0; i < fieldConditionsList.length; i++) {
      await form.toolbar.filter.add({
        title: fieldConditionsList[i].column,
        operation: fieldConditionsList[i].op,
        // subOperation: param.opSubType,
        value: fieldConditionsList[i].value,
        locallySaved: false,
        dataType: fieldConditionsList[i].dataType,
        openModal: false,
        skipWaitingResponse: true,
      });
    }

    await form.conditionalFields.click();

    await form.conditionalFields.verify({ isDisabled: false, count: '3' });

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: false });

    await form.fillForm([{ field: 'Text', value: 'Spain' }]);
    await form.fillForm([{ field: 'Email', value: 'user1@nocodb.com' }]);

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: false });

    await form.fillForm([{ field: 'Number', value: '22' }]);

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: true });

    await form.formHeading.scrollIntoViewIfNeeded();
    await form.formHeading.click();
    // reorder & verify error
    await form.reorderFields({
      sourceField: 'Number',
      destinationField: 'Currency',
    });

    await form.verifyFieldConfigError({ title: 'Decimal', hasError: true });

    await form.reorderFields({
      sourceField: 'Number',
      destinationField: 'Decimal',
    });

    await form.verifyFieldConfigError({ title: 'Decimal', hasError: false });

    // hide & verify error
    await form.formHeading.scrollIntoViewIfNeeded();
    await form.formHeading.click();

    await form.removeField({ field: 'Text', mode: 'hideField' });

    await form.verifyFieldConfigError({ title: 'Decimal', hasError: true });

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: true });

    await form.removeField({ field: 'Text', mode: 'hideField' });

    await form.verifyFieldConfigError({ title: 'Decimal', hasError: false });

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: true });

    await form.fillForm([{ field: 'Email', value: 'user@nocodb.com' }]);

    await form.conditionalFields.verifyVisibility({ title: 'Decimal', isVisible: false });

    await dashboard.rootPage.waitForTimeout(5000);

    // Shared form view
    const formLink = await dashboard.form.topbar.getSharedViewUrl();

    await dashboard.rootPage.goto(formLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();

    const sharedForm = new SharedFormPage(dashboard.rootPage);

    await sharedForm.verifyField({ title: 'Decimal', isVisible: false });

    await sharedForm.cell.fillText({
      columnHeader: 'Text',
      text: 'Spain',
      type: UITypes.SingleLineText,
    });

    await sharedForm.cell.fillText({
      columnHeader: 'Email',
      text: 'user1@nocodb.com',
      type: UITypes.Email,
    });

    await sharedForm.cell.fillText({
      columnHeader: 'Number',
      text: '22',
      type: UITypes.Number,
    });

    await sharedForm.verifyField({ title: 'Decimal', isVisible: true });

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await dashboard.rootPage.goto(url);
    // kludge- reload
    await dashboard.rootPage.reload();
  });
});
