import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { enableQuickRun, isEE } from '../../../setup/db';
import { Api } from 'nocodb-sdk';

test.describe('Form view scheduling', () => {
  if (enableQuickRun() || !isEE()) test.skip();

  let dashboard: DashboardPage;
  let form: FormPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    form = dashboard.form;
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function getFormViewId(tableTitle: string, viewTitle: string) {
    const table = await api.dbTable.list(context.base.id);
    const targetTable = table.list.find((t: any) => t.title === tableTitle);
    const views = await api.dbView.list(targetTable!.id!);
    return views.list.find((v: any) => v.title === viewTitle)!.id!;
  }

  function utcDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  }

  test('Scheduling toggle shows start and expiration date pickers', async () => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ScheduleForm' });

    const schedulingToggle = dashboard.rootPage.locator('[data-testid="nc-form-checkbox-scheduling"]');
    await expect(schedulingToggle).toBeVisible();

    // Enable scheduling
    await schedulingToggle.click();

    const startDatePicker = dashboard.rootPage.locator('[data-testid="nc-form-start-date-picker"]');
    const expirationPicker = dashboard.rootPage.locator('[data-testid="nc-form-expiration-picker"]');
    await expect(startDatePicker).toBeVisible();
    await expect(expirationPicker).toBeVisible();

    // Disable scheduling — pickers should hide
    await schedulingToggle.click();
    await expect(startDatePicker).not.toBeVisible();
    await expect(expirationPicker).not.toBeVisible();
  });

  test('Expired form shows expired state on shared view', async () => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ExpiredForm' });

    const formViewId = await getFormViewId('Country', 'ExpiredForm');

    await api.dbView.formUpdate(formViewId, {
      expires_at: utcDate(-1),
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
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'FutureForm' });

    const formViewId = await getFormViewId('Country', 'FutureForm');

    await api.dbView.formUpdate(formViewId, {
      starts_at: utcDate(7),
    });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // Verify not-started message and countdown
    await expect(dashboard.rootPage.locator('text=This form is not yet open')).toBeVisible({ timeout: 10000 });
    await expect(dashboard.rootPage.locator('text=Opens in')).toBeVisible();

    // Verify submit button is NOT visible
    await expect(dashboard.rootPage.locator('[data-testid="shared-form-submit-button"]')).not.toBeVisible();
  });

  test('Active form (within start/expiry window) accepts submissions', async () => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ActiveForm' });
    await form.removeAllFields();

    const formViewId = await getFormViewId('Country', 'ActiveForm');

    await api.dbView.formUpdate(formViewId, {
      starts_at: utcDate(-1),
      expires_at: utcDate(7),
    });

    const formLink = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.rootPage.goto(formLink);
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // Verify form is active — submit button visible
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

  test('Backend rejects submission on expired form', async () => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'ExpiredSubmitForm' });

    const formViewId = await getFormViewId('Country', 'ExpiredSubmitForm');

    // Set expiration to yesterday
    await api.dbView.formUpdate(formViewId, {
      expires_at: utcDate(-1),
    });

    // Try to submit via API — should be rejected
    const table = await api.dbTable.list(context.base.id);
    const countryTable = table.list.find((t: any) => t.title === 'Country');

    try {
      await api.dbTableRow.create('noco', context.base.id, countryTable!.id!, { Country: 'ShouldFail' }, {
        headers: {
          'xc-shared-base-id': formViewId,
        },
      } as any);
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.response?.status || e.status).toBe(400);
    }
  });

  test('Form builder shows scheduling alert for expired form', async () => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'AlertForm' });

    const formViewId = await getFormViewId('Country', 'AlertForm');

    // Set expiration to yesterday
    await api.dbView.formUpdate(formViewId, {
      expires_at: utcDate(-1),
    });

    // Reload to pick up the change
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });

    // The scheduling alert should be visible in the form builder
    await expect(dashboard.rootPage.locator('text=This form is no longer accepting responses')).toBeVisible({
      timeout: 10000,
    });
  });
});
