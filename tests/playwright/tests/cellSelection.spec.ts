import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { GridPage } from '../pages/Dashboard/Grid';
import setup from '../setup';

test.describe('Verify cell selection', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test('#1 when range is selected, it has correct number of selected cells', async () => {
    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 2, columnHeader: 'Email' },
    });

    expect(await grid.selectedCount()).toBe(9);
  });

  test('#2 when copied with clipboard, it copies correct text', async () => {
    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 1, columnHeader: 'LastName' },
    });

    expect(await grid.copyWithKeyboard()).toBe('MARY \t SMITH\n' + ' PATRICIA \t JOHNSON\n');
  });

  test('#3 when copied with mouse, it copies correct text', async () => {
    await dashboard.treeView.openTable({ title: 'Customer' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'FirstName' },
      end: { index: 1, columnHeader: 'LastName' },
    });

    expect(await grid.copyWithMouse({ index: 0, columnHeader: 'FirstName' })).toBe(
      'MARY \t SMITH\n' + ' PATRICIA \t JOHNSON\n'
    );
  });

  // FIXME: this is edge case, better be moved to integration tests
  test('#4 when cell inside selection range is clicked, it clears previous selection', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'City List' },
    });

    expect(await grid.selectedCount()).toBe(9);

    await grid.cell.get({ index: 0, columnHeader: 'Country' }).click();

    expect(await grid.selectedCount()).toBe(1);
    expect(await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' }));
  });

  // FIXME: this is edge case, better be moved to integration tests
  test('#5 when cell outside selection range is clicked, it clears previous selection', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'City List' },
    });

    expect(await grid.selectedCount()).toBe(9);

    await grid.cell.get({ index: 5, columnHeader: 'Country' }).click();

    expect(await grid.selectedCount()).toBe(1);
    expect(await grid.cell.verifyCellActiveSelected({ index: 5, columnHeader: 'Country' }));
  });

  // FIXME: this is edge case, better be moved to integration tests
  test('#6 when selection ends on locked field, it still works as expected', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.fields.toggleShowSystemFields();
    await grid.selectRange({
      start: { index: 2, columnHeader: 'City List' },
      end: { index: 0, columnHeader: 'Country' },
    });

    expect(await grid.selectedCount()).toBe(12);

    await grid.cell.get({ index: 1, columnHeader: 'Country' }).click();

    expect(await grid.selectedCount()).toBe(1);
    expect(await grid.cell.verifyCellActiveSelected({ index: 1, columnHeader: 'Country' }));
  });

  // FIXME: this is edge case, better be moved to integration tests
  test('#7 when navigated with keyboard, only active cell is affected', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Country' });
    await grid.selectRange({
      start: { index: 0, columnHeader: 'Country' },
      end: { index: 2, columnHeader: 'City List' },
    });

    await page.keyboard.press('ArrowRight');
    expect(await grid.selectedCount()).toBe(1);
    expect(await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'LastUpdate' }));
  });
});
