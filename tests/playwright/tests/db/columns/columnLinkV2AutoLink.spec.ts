import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

// Regression test for https://github.com/nocodb/nocodb/issues/13770
//
// Clicking "+ New record" on a V2 LTAR cell must:
//   1. Pre-fill the back-reference (MO) field on the expanded form with the
//      parent row (Symptom 1 of the bug — empty before fix).
//   2. Auto-link the newly-created record to the parent on save (Symptom 2 —
//      no junction row written before fix).
//
// Before the LinkedItems.vue fix, `newRowState` only handled the inverted
// fk_parent/fk_child shape for V1 MANY_TO_MANY. V2 OM/MO/OO/MM use the same
// junction-style layout but fell into the straight-match branch, so the
// reverse-relation column was never identified and the state propagated empty.
test.describe('V2 LTAR auto-link on create — #13770', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('V2 One-to-Many: new record from "+" auto-links to parent', async () => {
    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Sheet2', baseTitle: context.base.title });

    await dashboard.treeView.openTable({ title: 'Sheet1', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: '1a' });

    // `LinkToAnotherRecord` uidt defaults to V2; "One to Many" is V2-only.
    await dashboard.grid.column.create({
      title: 'Sheet2List',
      type: 'LinkToAnotherRecord',
      childTable: 'Sheet2',
      relationType: 'One to Many',
    });

    // Open the linked-items panel for the OM cell on the parent row.
    // For a Links.vue cell this clicks the `.nc-datatype-link` count text,
    // which triggers `openChildList` and renders LinkedItems.vue.
    await dashboard.grid.cell.inCellExpand({ index: 0, columnHeader: 'Sheet2List' });

    // Click "New record" — opens the expanded form for a new Sheet2 row.
    const newRecordBtn = dashboard.rootPage.getByTestId('nc-child-list-button-new-record');
    await newRecordBtn.waitFor({ state: 'visible' });
    await newRecordBtn.click();

    // The MO back-reference column auto-created on Sheet2 takes the source
    // table's name ("Sheet1"). The expanded form should pre-fill it with the
    // parent row's display value '1a'.
    const sheet1Field = dashboard.expandedForm.get().last().getByTestId('nc-expand-col-Sheet1');
    await sheet1Field.scrollIntoViewIfNeeded();
    await expect(sheet1Field.locator('.chip .name').first()).toHaveText('1a');

    // Fill the child row's title and save via the "Create & Link" button.
    await dashboard.expandedForm.fillField({ columnTitle: 'Title', value: '2a' });

    const saveBtn = dashboard.expandedForm.get().last().getByTestId('nc-expanded-form-save');
    await dashboard.rootPage.waitForTimeout(500);
    await Promise.all([
      dashboard.rootPage.waitForResponse(
        resp => resp.url().includes('/api/v') && resp.request().method() === 'POST' && resp.status() < 400
      ),
      saveBtn.click(),
    ]);

    // Settle: close the expanded form / linked-items panel.
    await dashboard.rootPage.keyboard.press('Escape');
    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.rootPage.keyboard.press('Escape');
    await dashboard.rootPage.waitForTimeout(500);

    // Symptom 2 — Sheet1 row 0 now reports 1 linked Sheet2 record.
    await dashboard.grid.cell.verifyVirtualCell({
      index: 0,
      columnHeader: 'Sheet2List',
      count: 1,
      options: { singular: 'Sheet2', plural: 'Sheet2s' },
    });
  });
});
