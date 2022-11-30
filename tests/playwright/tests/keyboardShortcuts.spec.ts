import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { GridPage } from '../pages/Dashboard/Grid';
import setup from '../setup';

test.describe('Verify shortcuts', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test('Verify shortcuts', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Country' });
    // create new table
    await page.keyboard.press('Alt+t');
    await dashboard.treeView.createTable({ title: 'New Table', skipOpeningModal: true });
    await dashboard.treeView.verifyTable({ title: 'New Table' });

    // create new row
    await grid.column.clickColumnHeader({ title: 'Title' });
    await page.waitForTimeout(2000);
    await page.keyboard.press('Alt+r');
    await grid.editRow({ index: 0, value: 'New Row' });
    await grid.verifyRowCount({ count: 1 });

    // create new column
    await page.keyboard.press('Alt+c');
    await grid.column.fillTitle({ title: 'New Column' });
    await grid.column.save();
    await grid.column.verify({ title: 'New Column' });

    // fullscreen
    await page.keyboard.press('Alt+f');
    await dashboard.treeView.verifyVisibility({
      isVisible: false,
    });
    await dashboard.viewSidebar.verifyVisibility({
      isVisible: false,
    });
    await page.keyboard.press('Alt+f');
    await dashboard.treeView.verifyVisibility({
      isVisible: true,
    });
    await dashboard.viewSidebar.verifyVisibility({
      isVisible: true,
    });

    // invite team member
    await page.keyboard.press('Alt+i');
    await dashboard.settings.teams.invite({
      email: 'new@example.com',
      role: 'editor',
      skipOpeningModal: true,
    });
    const url = await dashboard.settings.teams.getInvitationUrl();
    // await dashboard.settings.teams.closeInvite();
    expect(url).toContain('signup');
    await page.waitForTimeout(1000);
    await dashboard.settings.teams.closeInvite();

    // Cmd + Right arrow
    await dashboard.treeView.openTable({ title: 'Country' });
    await page.waitForTimeout(1500);
    await grid.cell.click({ index: 0, columnHeader: 'Country' });
    await page.waitForTimeout(1500);
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowRight' : 'Control+ArrowRight');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'City List' });

    // Cmd + Right arrow
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowLeft' : 'Control+ArrowLeft');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' });

    // Cmd + up arrow
    await grid.cell.click({ index: 24, columnHeader: 'Country' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowUp' : 'Control+ArrowUp');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' });

    // Cmd + down arrow
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowDown' : 'Control+ArrowDown');
    await grid.cell.verifyCellActiveSelected({ index: 24, columnHeader: 'Country' });

    // Enter to edit and Esc to cancel
    await grid.cell.click({ index: 0, columnHeader: 'Country' });
    await page.keyboard.press('Enter');
    await page.keyboard.type('New');
    await page.keyboard.press('Escape');
    await grid.cell.verify({ index: 0, columnHeader: 'Country', value: 'AfghanistanNew' });

    // Space to open expanded row and Meta + Space to save
    await grid.cell.click({ index: 1, columnHeader: 'Country' });
    await page.keyboard.press('Space');
    await dashboard.expandedForm.verify({
      header: 'Algeria',
    });
    await dashboard.expandedForm.fillField({ columnTitle: 'Country', value: 'NewAlgeria' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+Enter' : 'Control+Enter');
    await page.waitForTimeout(2000);
    await grid.cell.verify({ index: 1, columnHeader: 'Country', value: 'NewAlgeria' });
  });
});
