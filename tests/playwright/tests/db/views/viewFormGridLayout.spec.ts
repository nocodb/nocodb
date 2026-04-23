import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FormPage } from '../../../pages/Dashboard/Form';
import { SharedFormPage } from '../../../pages/SharedForm';
import { enableQuickRun } from '../../../setup/db';

// Form view — multi-column grid layout.
//
// NOTE: These tests exercise the two-level (rows × fields) drag-drop grid
// layout added to the form view. They rely on a `reorderFieldIntoRow` page
// helper which is TODO — add to pages/Dashboard/Form/index.ts when fleshing
// out this suite. Until then, use this spec as a manual smoke-test checklist:
//
//   1. Drag field B next to field A  → A and B share a row, equal width
//   2. Drag field C next to A/B      → three-up row, equal width
//   3. Try to drag 6th field into a row → drop should be rejected
//   4. Long-text / Attachment fields → always their own full-width row
//   5. Shared form URL on desktop    → renders multi-field rows
//   6. Shared form URL on mobile     → collapses to single column (<768px)

test.describe('Form view grid layout', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let form: FormPage;
  let sharedForm: SharedFormPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    form = dashboard.form;
    sharedForm = new SharedFormPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('two fields on the same row render at equal width', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.viewSidebar.createFormView({ title: 'GridForm' });

    // TODO: add a page-object helper to drag one field onto another's row.
    //   Expected call: await form.reorderFieldIntoRow({ sourceField: 'LastUpdate', targetField: 'Country' });
    test.fixme(true, 'TODO: add reorderFieldIntoRow helper');

    // Once the helper exists:
    //   const country = form.getField({ field: 'Country' });
    //   const lastUpdate = form.getField({ field: 'LastUpdate' });
    //   const countryBox = await country.boundingBox();
    //   const lastUpdateBox = await lastUpdate.boundingBox();
    //   expect(Math.abs(countryBox.width - lastUpdateBox.width)).toBeLessThan(2);
    //   expect(Math.abs(countryBox.y - lastUpdateBox.y)).toBeLessThan(2);
  });

  test('max 5 fields per row — 6th drop is rejected', async ({ page }) => {
    test.fixme(true, 'TODO: needs page-object drag helper + seeded table with 6+ visible fields');
  });

  test('long-text / attachment fields stay full-width', async ({ page }) => {
    test.fixme(
      true,
      'TODO: create a LongText field, attempt to drag it beside another field, assert it snaps back to its own row'
    );
  });

  test('shared form on mobile viewport collapses to single column', async ({ page }) => {
    test.fixme(
      true,
      'TODO: seed a form with a multi-field row, open shared URL at 375px wide, assert rows stack vertically'
    );
  });
});
