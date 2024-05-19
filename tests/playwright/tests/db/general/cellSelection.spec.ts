import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';

test.describe('Verify cell selection', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    await dashboard.closeAllTabs();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Suite-1', async () => {
    // #1 when range is selected, it has correct number of selected cells
    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 2, columnHeader: 'Email' },
    });
    expect(await grid.selectedCount()).toBe(9);
    await dashboard.closeAllTabs();

    // #2 when copied with clipboard, it copies correct text and paste
    const verifyPastedData = async ({ index }: { index: number }): Promise<void> => {
      // FirstName column
      let cellText: string[] = ['MARY', 'PATRICIA'];
      for (let i = index; i <= index + 1; i++) {
        await grid.cell.verify({ index: i, columnHeader: 'FirstName', value: cellText[i - index] });
      }

      // LastName column
      cellText = ['SMITH', 'JOHNSON'];
      for (let i = index; i <= index + 1; i++) {
        await grid.cell.verify({ index: i, columnHeader: 'LastName', value: cellText[i - index] });
      }
    };

    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 1, columnHeader: 'LastName' },
    });
    expect(await grid.copyWithKeyboard()).toBe('MARY\tSMITH\n' + 'PATRICIA\tJOHNSON');

    await grid.pasteWithMouse({ index: 2, columnHeader: 'FirstName' });
    await verifyPastedData({ index: 2 });

    await dashboard.closeAllTabs();

    // #3 when copied with mouse, it copies correct text and paste
    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 1, columnHeader: 'LastName' },
    });
    expect(await grid.copyWithMouse({ index: 0, columnHeader: 'FirstName' })).toBe(
      'MARY\tSMITH\n' + 'PATRICIA\tJOHNSON'
    );

    await grid.pasteWithMouse({ index: 4, columnHeader: 'FirstName' });
    await verifyPastedData({ index: 4 });
    await dashboard.closeAllTabs();
  });

  test('Suite-2', async ({ page }) => {
    // #4 when cell inside selection range is clicked, it clears previous selection
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'Cities' },
    });
    await grid.verifySelectedCellCount({ count: 9 });
    await grid.cell.get({ index: 0, columnHeader: 'Country' }).click();
    await grid.verifySelectedCellCount({ count: 1 });
    expect(await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' }));
    await dashboard.closeAllTabs();

    // #5 when cell outside selection range is clicked, it clears previous selection
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'Cities' },
    });
    await grid.verifySelectedCellCount({ count: 9 });
    await grid.cell.get({ index: 5, columnHeader: 'Country' }).click();
    await grid.verifySelectedCellCount({ count: 1 });
    expect(await grid.cell.verifyCellActiveSelected({ index: 5, columnHeader: 'Country' }));
    await dashboard.closeAllTabs();

    // #6 when selection ends on locked field, it still works as expected
    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.fields.toggleShowSystemFields();
    await grid.selectRange({
      start: { index: 2, columnHeader: 'Cities' },
      end: { index: 0, columnHeader: 'Country' },
    });
    await grid.verifySelectedCellCount({ count: 12 });
    await grid.cell.get({ index: 1, columnHeader: 'Country' }).click();
    await grid.verifySelectedCellCount({ count: 1 });
    expect(await grid.cell.verifyCellActiveSelected({ index: 1, columnHeader: 'Country' }));
    await dashboard.grid.toolbar.fields.toggleShowSystemFields();
    await dashboard.closeAllTabs();

    // #7 when navigated with keyboard, only active cell is affected
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'Cities' },
    });
    await grid.verifySelectedCellCount({ count: 9 });
    await grid.rootPage.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await grid.verifySelectedCellCount({ count: 1 });
    expect(await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'LastUpdate' }));
    await dashboard.closeAllTabs();
  });
});
