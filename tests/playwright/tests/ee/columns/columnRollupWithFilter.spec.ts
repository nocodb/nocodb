import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';
import { LTARFilterPage } from '../../../pages/Dashboard/Grid/Column/LTARFilterOption';

test.describe('Rollup with filter condition persistence', () => {
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

  test('Rollup filter conditions persist after save and reload', async ({ page }) => {
    // Wait for the EE dashboard to fully hydrate before interacting
    await page.locator('.nc-treeview-container').waitFor({ state: 'visible', timeout: 30000 });

    // 1. Create two tables via UI
    await dashboard.treeView.createTable({ title: 'ParentTable', baseTitle: context.base.title });
    await page.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'ChildTable', baseTitle: context.base.title });
    await page.waitForTimeout(1000);

    // 2. Add rows via API (avoids EE grid header timing issues)
    const api = context.api;
    const tables = await api.dbTable.list(context.base.id);
    const childTable = tables.list.find((t: any) => t.title === 'ChildTable');
    const parentTable = tables.list.find((t: any) => t.title === 'ParentTable');

    await api.dbTableRow.bulkCreate('noco', context.base.id, childTable.id, [
      { Title: 'Child1' },
      { Title: 'Child2' },
      { Title: 'Child3' },
    ]);
    await api.dbTableRow.bulkCreate('noco', context.base.id, parentTable.id, [
      { Title: 'Parent1' },
      { Title: 'Parent2' },
    ]);

    // 3. Open ParentTable and wait for grid
    await dashboard.treeView.openTable({ title: 'ParentTable', baseTitle: context.base.title });
    await page.locator('[data-testid="nc-grid-wrapper"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    // 4. Create a LTAR (One to Many) column pointing to ChildTable
    await dashboard.grid.column.create({
      title: 'Link-HM',
      type: 'LinkToAnotherRecord',
      childTable: 'ChildTable',
      relationType: 'One to Many',
    });

    await page.waitForTimeout(500);

    // 5. Create a Rollup column on the link
    await dashboard.grid.column.create({
      title: 'RollupCount',
      type: 'Rollup',
      childTable: 'Link-HM',
      childColumn: 'Title',
      rollupType: 'count',
    });

    await page.waitForTimeout(500);

    // 6. Open the Rollup column for editing and add a filter condition
    await dashboard.grid.column.openEdit({ title: 'RollupCount' });
    await page.waitForTimeout(500);

    // Click the "Only include linked records that meet specific conditions" toggle
    const columnForm = page.locator('form[data-testid="add-or-edit-column"]');
    const filterToggle = columnForm.getByTestId('nc-rollup-limit-record-filters');
    await filterToggle.click();
    await page.waitForTimeout(500);

    // Add a filter condition: Title is equal Child1
    const filterPage = new LTARFilterPage(page);
    await filterPage.add({
      title: 'Title',
      operation: 'is equal',
      value: 'Child1',
      locallySaved: true,
      skipWaitingResponse: true,
    });

    await page.waitForTimeout(500);

    // 7. Save the column update
    await dashboard.grid.column.save({ isUpdated: true });
    await page.waitForTimeout(1000);

    // 8. Re-open the Rollup column for editing
    await dashboard.grid.column.openEdit({ title: 'RollupCount' });
    await page.waitForTimeout(1000);

    // 9. Verify the condition toggle is still ON
    const switchAfterSave = columnForm.getByTestId('nc-rollup-limit-record-filters');
    await expect(switchAfterSave).toBeVisible();
    await expect(switchAfterSave).toHaveClass(/ant-switch-checked/);

    // 10. Verify the filter row is visible with the correct values
    const filterSection = page.getByTestId('nc-filter');
    await expect(filterSection).toBeVisible();
    await expect(filterSection.locator('.nc-filter-field-select')).toBeVisible();

    // 11. Now reload the page entirely and verify persistence
    await page.reload();
    await page.locator('.nc-treeview-container').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Navigate back to the table
    await dashboard.treeView.openTable({ title: 'ParentTable', baseTitle: context.base.title });
    await page.locator('[data-testid="nc-grid-wrapper"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Re-open the Rollup column for editing
    await dashboard.grid.column.openEdit({ title: 'RollupCount' });
    await page.waitForTimeout(1000);

    // Verify toggle is still ON after reload
    const switchAfterReload = columnForm.getByTestId('nc-rollup-limit-record-filters');
    await expect(switchAfterReload).toBeVisible();
    await expect(switchAfterReload).toHaveClass(/ant-switch-checked/);

    // Verify the filter row is still present
    const filterSectionAfterReload = page.getByTestId('nc-filter');
    await expect(filterSectionAfterReload).toBeVisible();
    await expect(filterSectionAfterReload.locator('.nc-filter-field-select')).toBeVisible();

    // Cleanup: close the editor
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Delete columns and tables
    await dashboard.grid.column.delete({ title: 'RollupCount' });
    await dashboard.grid.column.delete({ title: 'Link-HM' });
    await dashboard.treeView.deleteTable({ title: 'ParentTable' });
    await dashboard.treeView.deleteTable({ title: 'ChildTable' });
  });
});
