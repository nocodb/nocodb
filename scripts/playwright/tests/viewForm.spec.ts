import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { SettingTab } from '../pages/Dashboard/Settings';
import setup from '../setup';
import { FormPage } from '../pages/Dashboard/Form';

// todo: Move most of the ui actions to page object and await on the api response
test.describe('Form view', () => {
  let dashboard: DashboardPage;
  let form: FormPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    form = dashboard.form;
  });

  test('Field re-order operations', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 1 });

    // verify form-view fields order
    await form.verifyFormViewFieldsOrder({
      fields: ['Country', 'LastUpdate', 'City List'],
    });

    // reorder & verify
    await form.reorderFields({
      sourceField: 'LastUpdate',
      destinationField: 'Country',
    });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
    });

    // remove & verify (drag-drop)
    await form.removeField({ field: 'City List', mode: 'dragDrop' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (drag-drop)
    await form.addField({ field: 'City List', mode: 'dragDrop' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'City List', 'Country'],
    });

    // remove & verify (hide field button)
    await form.removeField({ field: 'City List', mode: 'hideField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (hide field button)
    await form.addField({ field: 'City List', mode: 'clickField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
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
      fields: ['LastUpdate', 'Country', 'City List'],
    });
  });

  test('Form elements validation', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 1 });

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
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    await form.configureSubmitMessage({
      message: 'Custom submit message',
    });
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Custom submit message',
    });

    // enable 'submit another form' option
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
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

    // activate SMTP plugin
    await dashboard.gotoSettings();
    await dashboard.settings.selectTab({ tab: SettingTab.AppStore });
    await dashboard.settings.appStore.install({ name: 'SMTP' });
    await dashboard.settings.appStore.configureSMTP({
      email: 'a@b.com',
      host: 'smtp.gmail.com',
      port: '587',
    });
    await dashboard.verifyToast({
      message: 'Successfully installed and email notification will use SMTP configuration',
    });
    await dashboard.settings.close();

    // enable 'email-me' option
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    await form.emailMeRadioButton.click();
    await form.verifyAfterSubmitMenuState({
      emailMe: true,
      submitAnotherForm: false,
      showBlankForm: false,
    });

    // reset SMTP
    await dashboard.gotoSettings();
    await dashboard.settings.selectTab({ tab: SettingTab.AppStore });
    await dashboard.settings.appStore.uninstall({ name: 'SMTP' });

    await dashboard.verifyToast({
      message: 'Plugin uninstalled successfully',
    });
    await dashboard.settings.close();
  });
});
