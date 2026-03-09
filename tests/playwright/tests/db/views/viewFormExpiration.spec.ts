import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { enableQuickRun, isEE } from '../../../setup/db';
import { Api } from 'nocodb-sdk';

test.describe('Form view scheduling', () => {
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

  test('Scheduling toggle shows start and expiration date pickers', async () => {
    if (!isEE()) test.skip();

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ScheduleForm' });

    // Verify scheduling toggle exists
    const schedulingToggle = dashboard.rootPage.locator('[data-testid="nc-form-checkbox-scheduling"]');
    await expect(schedulingToggle).toBeVisible();

    // Enable scheduling
    await schedulingToggle.click();

    // Verify both date pickers appear
    const startDatePicker = dashboard.rootPage.locator('[data-testid="nc-form-start-date-picker"]');
    const expirationPicker = dashboard.rootPage.locator('[data-testid="nc-form-expiration-picker"]');
    await expect(startDatePicker).toBeVisible();
    await expect(expirationPicker).toBeVisible();

    // Disable scheduling
    await schedulingToggle.click();
    await expect(startDatePicker).not.toBeVisible();
    await expect(expirationPicker).not.toBeVisible();
  });

  test('Expired form shows expired state on shared view', async () => {
    if (!isEE()) test.skip();

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ExpiredForm' });
    await form.removeAllFields();

    // Set expiration to yesterday via API
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    const table = await api.dbTable.list(context.base.id);
    const countryTable = table.list.find((t: any) => t.title === 'Country');
    const views = await api.dbView.list(countryTable!.id!);
    const formView = views.list.find((v: any) => v.title === 'ExpiredForm');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await api.dbView.formUpdate(formView!.id!, {
      expires_at: yesterday.toISOString(),
    });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // Verify expired message
    await expect(dashboard.rootPage.locator('text=This form is no longer accepting responses')).toBeVisible({
      timeout: 10000,
    });

    // Verify submit button is NOT visible
    await expect(dashboard.rootPage.locator('[data-testid="shared-form-submit-button"]')).not.toBeVisible();
  });

  test('Not-started form shows countdown on shared view', async () => {
    if (!isEE()) test.skip();

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'FutureForm' });
    await form.removeAllFields();

    // Set start date to next week via API
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    const table = await api.dbTable.list(context.base.id);
    const countryTable = table.list.find((t: any) => t.title === 'Country');
    const views = await api.dbView.list(countryTable!.id!);
    const formView = views.list.find((v: any) => v.title === 'FutureForm');

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await api.dbView.formUpdate(formView!.id!, {
      starts_at: nextWeek.toISOString(),
    });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // Verify waiting / not started message
    await expect(dashboard.rootPage.locator('text=This form is not yet open')).toBeVisible({ timeout: 10000 });

    // Verify countdown is visible (check for "Opens in" label)
    await expect(dashboard.rootPage.locator('text=Opens in')).toBeVisible();

    // Verify submit button is NOT visible
    await expect(dashboard.rootPage.locator('[data-testid="shared-form-submit-button"]')).not.toBeVisible();
  });

  test('Active form (within start/expiry window) accepts submissions', async () => {
    if (!isEE()) test.skip();

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ActiveForm' });
    await form.removeAllFields();

    // Set start date to yesterday, expiration to next week
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    const table = await api.dbTable.list(context.base.id);
    const countryTable = table.list.find((t: any) => t.title === 'Country');
    const views = await api.dbView.list(countryTable!.id!);
    const formView = views.list.find((v: any) => v.title === 'ActiveForm');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await api.dbView.formUpdate(formView!.id!, {
      starts_at: yesterday.toISOString(),
      expires_at: nextWeek.toISOString(),
    });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // Verify form is active
    await expect(dashboard.rootPage.locator('[data-testid="shared-form-submit-button"]')).toBeVisible({
      timeout: 10000,
    });

    // Submit should work
    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.fillText({
      columnHeader: 'Country',
      text: 'TestCountry',
    });
    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
  });
});
