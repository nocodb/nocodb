import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { SurveyFormPage } from '../../../pages/Dashboard/SurveyForm';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

test.describe('Share form', () => {
  let dashboard: DashboardPage;
  let surveyForm: SurveyFormPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Survey', async () => {
    if (enableQuickRun()) test.skip();

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({
      title: 'Country Form',
    });
    await dashboard.form.configureHeader({
      title: 'Country Title',
      subtitle: 'Country Form Subtitle',
    });
    await dashboard.form.configureSubmitMessage({
      message: 'Thank you for submitting the form',
    });
    await dashboard.form.showAnotherFormRadioButton.click();
    await dashboard.form.showAnotherFormAfter5SecRadioButton.click();

    const surveyLink = await dashboard.form.topbar.getSharedViewUrl(true);
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.rootPage.goto(surveyLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    surveyForm = new SurveyFormPage(dashboard.rootPage);
    await surveyForm.validate({
      heading: 'Country Title',
      subHeading: 'Country Form Subtitle',
      fieldLabel: 'Country *',
      footer: '1 / 3',
    });
    await surveyForm.fill({
      fieldLabel: 'Country',
      value: 'New Country',
      type: 'SingleLineText',
    });

    await surveyForm.validate({
      heading: 'Country Title',
      subHeading: 'Country Form Subtitle',
      fieldLabel: 'LastUpdate',
      footer: '2 / 3',
    });
    await surveyForm.fill({
      fieldLabel: 'LastUpdate',
      type: 'DateTime',
    });

    await surveyForm.validate({
      heading: 'Country Title',
      subHeading: 'Country Form Subtitle',
      fieldLabel: 'Cities',
      footer: '3 / 3',
    });
    await surveyForm.submitButton.click();

    // validate post submit data
    await surveyForm.validateSuccessMessage({
      message: 'Thank you for submitting the form',
      showAnotherForm: true,
    });
  });
});
