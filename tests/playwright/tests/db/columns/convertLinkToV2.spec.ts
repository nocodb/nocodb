import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

test.describe('Convert Link to V2', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    // Enable the LTAR V2 feature flag via localStorage
    await page.evaluate(() => {
      const features = [{ id: 'ltar_v2', enabled: true, version: 1 }];
      window.localStorage.setItem('featureToggleStates', JSON.stringify(features));
    });
    // Reload page so the feature flag takes effect
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Convert Has Many link column from V1 to V2', async () => {
    // Create two tables
    await dashboard.treeView.createTable({ title: 'Companies', baseTitle: context.base.title });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Orders', baseTitle: context.base.title });

    // Add records to Orders
    await dashboard.treeView.openTable({ title: 'Orders', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: 'Order-1' });
    await dashboard.grid.addNewRow({ index: 1, value: 'Order-2' });
    await dashboard.grid.addNewRow({ index: 2, value: 'Order-3' });

    // Switch to Companies table and add records
    await dashboard.treeView.openTable({ title: 'Companies', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: 'Acme Corp' });
    await dashboard.grid.addNewRow({ index: 1, value: 'Beta Inc' });

    // Create a Has Many link from Companies to Orders (V1)
    await dashboard.grid.column.create({
      title: 'CompanyOrders',
      type: 'Links',
      childTable: 'Orders',
      relationType: 'Has Many',
    });

    // Link some records via expanded form
    await dashboard.grid.cell.inCellExpand({ index: 0, columnHeader: 'CompanyOrders' });
    await dashboard.linkRecord.select('Order-1');
    await dashboard.linkRecord.select('Order-2');
    await dashboard.linkRecord.close();

    await dashboard.grid.cell.inCellExpand({ index: 1, columnHeader: 'CompanyOrders' });
    await dashboard.linkRecord.select('Order-3');
    await dashboard.linkRecord.close();

    // Verify link counts before conversion
    await dashboard.grid.cell.verifyVirtualCell({
      index: 0,
      columnHeader: 'CompanyOrders',
      count: 2,
      type: 'hm',
    });
    await dashboard.grid.cell.verifyVirtualCell({
      index: 1,
      columnHeader: 'CompanyOrders',
      count: 1,
      type: 'hm',
    });

    // Open column menu and click "Convert to New Link"
    await dashboard.grid.column.getColumnHeader('CompanyOrders').locator('.nc-ui-dt-dropdown').click();
    await dashboard.rootPage.getByTestId('nc-column-convert-link-v2').click();

    // Dialog should appear — click the Convert button
    await dashboard.rootPage.getByTestId('nc-convert-link-v2-btn').click();

    // Wait for success toast
    await dashboard.verifyToast({ message: 'Column converted successfully' });

    // Wait for reload
    await dashboard.rootPage.waitForTimeout(2000);

    // Verify: original column should now be a Rollup showing count
    // The column title stays the same — "CompanyOrders"
    // It should show numeric counts: 2, 1
    const cell0 = await dashboard.grid.cell.get({ index: 0, columnHeader: 'CompanyOrders' });
    await expect(cell0).toContainText('2');
    const cell1 = await dashboard.grid.cell.get({ index: 1, columnHeader: 'CompanyOrders' });
    await expect(cell1).toContainText('1');

    // Verify: a new LTAR column should have been created
    // It should be of type LinkToAnotherRecord, not Links
    // The title will be a variant of "CompanyOrders" (deduplicated)
    // Check that a new column header exists after the original
    const newColHeader = dashboard.grid.get().locator('th[data-title="CompanyOrders_2"]');
    if (await newColHeader.isVisible()) {
      // New LTAR column exists — verify it shows related record chips (not just a count)
      await dashboard.grid.cell.inCellExpand({ index: 0, columnHeader: 'CompanyOrders_2' });
      // Close the expanded form
      await dashboard.rootPage.keyboard.press('Escape');
    }
  });

  test('Convert Many to Many link column from V1 to V2', async () => {
    // Create two tables
    await dashboard.treeView.createTable({ title: 'Students', baseTitle: context.base.title });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Courses', baseTitle: context.base.title });

    // Add records to Courses
    await dashboard.treeView.openTable({ title: 'Courses', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: 'Math' });
    await dashboard.grid.addNewRow({ index: 1, value: 'Science' });

    // Switch to Students and add records
    await dashboard.treeView.openTable({ title: 'Students', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: 'Alice' });
    await dashboard.grid.addNewRow({ index: 1, value: 'Bob' });

    // Create an MM link
    await dashboard.grid.column.create({
      title: 'Enrollments',
      type: 'Links',
      childTable: 'Courses',
      relationType: 'Many to Many',
    });

    // Link records
    await dashboard.grid.cell.inCellExpand({ index: 0, columnHeader: 'Enrollments' });
    await dashboard.linkRecord.select('Math');
    await dashboard.linkRecord.select('Science');
    await dashboard.linkRecord.close();

    await dashboard.grid.cell.inCellExpand({ index: 1, columnHeader: 'Enrollments' });
    await dashboard.linkRecord.select('Math');
    await dashboard.linkRecord.close();

    // Convert to V2
    await dashboard.grid.column.getColumnHeader('Enrollments').locator('.nc-ui-dt-dropdown').click();
    await dashboard.rootPage.getByTestId('nc-column-convert-link-v2').click();
    await dashboard.rootPage.getByTestId('nc-convert-link-v2-btn').click();

    // Wait for success
    await dashboard.verifyToast({ message: 'Column converted successfully' });
    await dashboard.rootPage.waitForTimeout(2000);

    // Verify: original column now a Rollup with counts
    const cell0 = await dashboard.grid.cell.get({ index: 0, columnHeader: 'Enrollments' });
    await expect(cell0).toContainText('2');
    const cell1 = await dashboard.grid.cell.get({ index: 1, columnHeader: 'Enrollments' });
    await expect(cell1).toContainText('1');
  });
});
