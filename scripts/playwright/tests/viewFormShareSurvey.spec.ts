import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { SurveyFormPage } from '../pages/Dashboard/SurveyForm';
import setup from '../setup';

test.describe('Share form', () => {
  let dashboard: DashboardPage;
  let surveyForm: SurveyFormPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Survey', async () => {
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
    await dashboard.form.toolbar.clickShareView();
    await dashboard.form.toolbar.shareView.toggleSurveyMode();

    const surveyLink = await dashboard.form.toolbar.shareView.getShareLink();
    await dashboard.rootPage.waitForTimeout(2000);
    await dashboard.rootPage.goto(surveyLink);
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
      fieldLabel: 'City List',
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
