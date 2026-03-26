import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';
import { LTARFilterPage } from '../../../pages/Dashboard/Grid/Column/LTARFilterOption';

test.describe('Rollup filter condition persistence across field switches', () => {
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

  test('Rollup filter conditions persist when switching fields in Details > Fields view', async ({ page }) => {
    await page.locator('.nc-treeview-container').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Create two tables
    await dashboard.treeView.createTable({ title: 'ParentTable', baseTitle: context.base.title });
    await page.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'ChildTable', baseTitle: context.base.title });
    await page.waitForTimeout(1000);

    // 2. Add rows via API
    const api = context.api;
    const tables = await api.dbTable.list(context.base.id);
    const childTable = tables.list.find((t: any) => t.title === 'ChildTable');
    const parentTable = tables.list.find((t: any) => t.title === 'ParentTable');

    await api.dbTableRow.bulkCreate('noco', context.base.id, childTable.id, [{ Title: 'Child1' }, { Title: 'Child2' }]);
    await api.dbTableRow.bulkCreate('noco', context.base.id, parentTable.id, [{ Title: 'Parent1' }]);

    // 3. Open ParentTable, create Links and Rollup columns via grid editor
    await dashboard.treeView.openTable({ title: 'ParentTable', baseTitle: context.base.title });
    await page.locator('[data-testid="nc-grid-wrapper"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    await dashboard.grid.column.create({
      title: 'Link-HM',
      type: 'LinkToAnotherRecord',
      childTable: 'ChildTable',
      relationType: 'One to Many',
    });
    await page.waitForTimeout(500);

    await dashboard.grid.column.create({
      title: 'RollupCount',
      type: 'Rollup',
      childTable: 'Link-HM',
      childColumn: 'Title',
      rollupType: 'count',
    });
    await page.waitForTimeout(500);

    // 4. Open Details > Fields view
    await dashboard.grid.topbar.openDetailedTab({ waitForResponse: false });
    await dashboard.details.clickFieldsTab();
    await page.waitForTimeout(1000);

    const fields = dashboard.details.fields;

    // 5. Click on the RollupCount field in the sidebar
    await fields.getField({ title: 'RollupCount' }).click();
    await page.waitForTimeout(1000);

    // 6. Enable the condition toggle and add a filter
    const columnForm = fields.addOrEditColumn;
    const filterToggle = columnForm.getByTestId('nc-rollup-limit-record-filters');
    await filterToggle.scrollIntoViewIfNeeded();
    await filterToggle.click();
    await page.waitForTimeout(500);

    const filterPage = new LTARFilterPage(page);
    await filterPage.add({
      title: 'Title',
      operation: 'is equal',
      value: 'Child1',
      locallySaved: true,
      skipWaitingResponse: true,
    });
    await page.waitForTimeout(500);

    // 7. Verify filter is visible before switching
    const filterSection = page.getByTestId('nc-filter');
    await expect(filterSection).toBeVisible();
    await expect(filterSection.locator('.nc-filter-field-select')).toBeVisible();

    // 8. Switch to another field (Title) WITHOUT saving
    await fields.getField({ title: 'Title' }).click();
    await page.waitForTimeout(1000);

    // 9. Switch back to RollupCount
    await fields.getField({ title: 'RollupCount' }).click();
    await page.waitForTimeout(1000);

    // 10. Verify the condition toggle is still ON
    const switchAfterSwitch = columnForm.getByTestId('nc-rollup-limit-record-filters');
    await switchAfterSwitch.scrollIntoViewIfNeeded();
    await expect(switchAfterSwitch).toBeVisible();
    await expect(switchAfterSwitch).toHaveClass(/ant-switch-checked/);

    // 11. Verify the filter row is still visible
    const filterSectionAfterSwitch = page.getByTestId('nc-filter');
    await expect(filterSectionAfterSwitch).toBeVisible();
    await expect(filterSectionAfterSwitch.locator('.nc-filter-field-select')).toBeVisible();

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });
});
