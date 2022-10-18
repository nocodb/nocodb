import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("Form view", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Field re-order operations", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.viewSidebar.createFormView({ title: "CountryForm" });
    await dashboard.viewSidebar.verifyView({ title: "CountryForm", index: 1 });

    // verify form-view fields order
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["Country", "LastUpdate", "City List"],
    });

    // reorder & verify
    await dashboard.form.reorderFields({
      sourceField: "LastUpdate",
      destinationField: "Country",
    });
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "Country", "City List"],
    });

    // remove & verify (drag-drop)
    await dashboard.form.removeField({ field: "City List", mode: "dragDrop" });
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "Country"],
    });

    // add & verify (drag-drop)
    await dashboard.form.addField({ field: "City List", mode: "dragDrop" });
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "City List", "Country"],
    });

    // remove & verify (hide field button)
    await dashboard.form.removeField({ field: "City List", mode: "hideField" });
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "Country"],
    });

    // add & verify (hide field button)
    await dashboard.form.addField({ field: "City List", mode: "clickField" });
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "Country", "City List"],
    });

    // remove-all & verify
    await dashboard.form.removeAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["Country"],
    });

    // // add-all & verify
    await dashboard.form.addAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.form.verifyFormViewFieldsOrder({
      fields: ["LastUpdate", "Country", "City List"],
    });
  });

  test("Form elements validation", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.viewSidebar.createFormView({ title: "CountryForm" });
    await dashboard.viewSidebar.verifyView({ title: "CountryForm", index: 1 });

    await dashboard.form.configureHeader({
      title: "Country",
      subtitle: "Country subtitle",
    });
    await dashboard.form.verifyHeader({
      title: "Country",
      subtitle: "Country subtitle",
    });

    // retain only 'Country' field
    await dashboard.form.removeAllFields();

    // submit default form validation
    await dashboard.form.fillForm([{ field: "Country", value: "_abc" }]);
    await dashboard.form.submitForm();
    await dashboard.form.verifyStatePostSubmit({
      message: "Successfully submitted form data",
    });

    // submit custom form validation
    await dashboard.viewSidebar.openView({ title: "CountryForm" });
    await dashboard.form.configureSubmitMessage({
      message: "Custom submit message",
    });
    await dashboard.form.fillForm([{ field: "Country", value: "_abc" }]);
    await dashboard.form.submitForm();
    await dashboard.form.verifyStatePostSubmit({
      message: "Custom submit message",
    });

    // enable 'submit another form' option
    await dashboard.viewSidebar.openView({ title: "CountryForm" });
    await dashboard.form.showAnotherFormRadioButton.click();
    await dashboard.form.fillForm([{ field: "Country", value: "_abc" }]);
    await dashboard.form.submitForm();
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.form.verifyStatePostSubmit({
      submitAnotherForm: true,
    });
    await dashboard.form.submitAnotherForm().click();

    // enable 'show another form' option
    await dashboard.form.showAnotherFormRadioButton.click();
    await dashboard.form.showAnotherFormAfter5SecRadioButton.click();
    await dashboard.form.fillForm([{ field: "Country", value: "_abc" }]);
    await dashboard.form.fillForm([{ field: "Country", value: "_abc" }]);
    await dashboard.form.submitForm();
    await dashboard.rootPage.waitForTimeout(6000);
    await dashboard.form.verifyStatePostSubmit({
      showBlankForm: true,
    });

    // enable 'email-me' option
    await dashboard.form.showAnotherFormAfter5SecRadioButton.click();
    await dashboard.form.emailMeRadioButton.click();
    await dashboard.toastWait({
      message:
        "Please activate SMTP plugin in App store for enabling email notification",
    });

    // activate SMTP plugin
    await dashboard.gotoSettings();
    await dashboard.settings.selectTab({ title: "App Store" });
    await dashboard.settings.appStore.install({ name: "SMTP" });
    await dashboard.settings.appStore.configureSMTP({
      email: "a@b.com",
      host: "smtp.gmail.com",
      port: "587",
    });
    await dashboard.toastWait({
      message:
        "Successfully installed and email notification will use SMTP configuration",
    });
    await dashboard.settings.close();

    // enable 'email-me' option
    await dashboard.viewSidebar.openView({ title: "CountryForm" });
    await dashboard.form.emailMeRadioButton.click();
    await dashboard.form.verifyAfterSubmitMenuState({
      emailMe: true,
      submitAnotherForm: false,
      showBlankForm: false,
    });

    // reset SMTP
    await dashboard.gotoSettings();
    await dashboard.settings.selectTab({ title: "App Store" });
    await dashboard.settings.appStore.uninstall({ name: "SMTP" });

    await dashboard.toastWait({
      message: "Plugin uninstalled successfully",
    });
    await dashboard.settings.close();
  });
});
