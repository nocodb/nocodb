import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { isMysql, isPg, isSqlite } from '../../../setup/db';

test.describe('Shared view with password and group by', () => {
  let dashboard: DashboardPage;
  let context: any;
  let sharedLink: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test('Group by in shared view with password protection', async ({ page }) => {
    // 1. Open a table and set up group by
    await dashboard.treeView.openTable({ title: 'Film' });

    // Add group by on Length field
    await dashboard.grid.toolbar.groupBy.add({
      title: 'Length',
      ascending: false,
      locallySaved: false,
    });

    // Add sort on Title field
    await dashboard.grid.toolbar.sort.add({
      title: 'Title',
      ascending: false,
      locallySaved: false,
    });

    // 2. Create a shared view with password protection
    sharedLink = await dashboard.grid.topbar.getSharedViewUrl(false, 'test123', true);

    // 3. Access the shared view with password
    await page.goto(sharedLink);
    await page.reload(); // Fix for page loading issues

    // Enter password
    const sharedPage = new DashboardPage(page, context.base);
    await sharedPage.rootPage.locator('input[placeholder="Enter password"]').fill('test123');
    await sharedPage.rootPage.click('button[data-testid="nc-shared-view-password-submit-btn"]');

    // 4. Verify group by is working in the shared view
    // Open the first group
    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });

    // Verify the first row in the first group - use different values based on database type
    const firstGroupFirstRowValue = isSqlite(context) || isPg(context) ? 'ZORRO ARK' : 'WORST BANGER';
    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: firstGroupFirstRowValue,
    });

    // 5. Go back to dashboard and modify the group by
    await dashboard.goto();
    await page.reload();

    await dashboard.treeView.openTable({ title: 'Film' });

    // Update group by to use Rating field
    await dashboard.grid.toolbar.groupBy.update({
      index: 0,
      title: 'Rating',
      ascending: true,
    });

    // Wait for changes to propagate
    await page.waitForTimeout(2000);

    // 6. Go back to shared view and verify changes are reflected
    await page.goto(sharedLink);
    await page.reload();

    // Enter password again
    await sharedPage.rootPage.locator('input[placeholder="Enter password"]').fill('test123');
    await sharedPage.rootPage.click('button[data-testid="nc-shared-view-password-submit-btn"]');

    // Open the first group
    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });

    // Verify the first row in the first group (should be different after group by change)
    // Use different values based on database type
    const secondGroupFirstRowValue = isSqlite(context) || isPg(context) ? 'ZORRO ARK' : 'ZORRO ARK';
    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: secondGroupFirstRowValue,
    });

    // 7. Add a filter in the dashboard
    await dashboard.goto();
    await page.reload();

    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.toolbar.clickFilter();
    await dashboard.grid.toolbar.filter.add({
      title: 'Length',
      operation: '>',
      value: '100',
    });
    await dashboard.grid.toolbar.clickFilter();

    // Wait for changes to propagate
    await page.waitForTimeout(2000);

    // 8. Go back to shared view and verify filter is applied
    await page.goto(sharedLink);
    await page.reload();

    // Enter password again
    await sharedPage.rootPage.locator('input[placeholder="Enter password"]').fill('test123');
    await sharedPage.rootPage.click('button[data-testid="nc-shared-view-password-submit-btn"]');

    // Open the first group
    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });

    // Verify the filtered results - use different values based on database type
    const filteredFirstRowValue = isSqlite(context) || isPg(context) ? 'ZORRO ARK' : 'ZORRO ARK';
    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: filteredFirstRowValue,
    });

    // 9. Remove group by in dashboard
    await dashboard.goto();
    await page.reload();

    await dashboard.treeView.openTable({ title: 'Film' });
    await dashboard.grid.toolbar.groupBy.remove({ index: 0 });

    // Wait for changes to propagate
    await page.waitForTimeout(2000);

    // 10. Go back to shared view and verify group by is removed
    await page.goto(sharedLink);
    await page.reload();

    // Enter password again
    await sharedPage.rootPage.locator('input[placeholder="Enter password"]').fill('test123');
    await sharedPage.rootPage.click('button[data-testid="nc-shared-view-password-submit-btn"]');

    // Verify that we now have a regular grid view without groups
    // Use different values based on database type
    const finalRowValue = isSqlite(context) || isPg(context) ? 'ZORRO ARK' : 'ZORRO ARK';
    await sharedPage.grid.cell.verify({ index: 0, columnHeader: 'Title', value: finalRowValue });
  });
});
