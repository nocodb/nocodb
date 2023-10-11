import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { Api, UITypes } from 'nocodb-sdk';
import { LoginPage } from '../../../pages/LoginPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
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

    // remove & verify (drag-drop)
    await form.removeField({ field: 'Cities', mode: 'dragDrop' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (drag-drop)
    await form.addField({ field: 'Cities', mode: 'dragDrop' });
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

  test('Form elements validation', async ({ page }) => {
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
    const url = dashboard.rootPage.url();

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
  let wsPage: WorkspacePage;
  let context: any;
  let api: Api<any>;

  let cityTable: any, countryTable: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    loginPage = new LoginPage(page);
    wsPage = new WorkspacePage(page);

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
    });

    // Click on multi select options
    const multiSelectParams = {
      index: -1,
      columnHeader: 'MultiSelect',
      option: 'jan',
      multiSelect: true,
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
