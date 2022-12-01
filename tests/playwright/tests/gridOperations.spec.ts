import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

test.describe('Grid operations', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Clipboard support', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.createTable({ title: 'Sheet1' });

    await dashboard.grid.column.create({
      title: 'Number',
      type: 'Number',
    });
    await dashboard.grid.column.create({
      title: 'Checkbox',
      type: 'Checkbox',
    });
    await dashboard.grid.column.create({
      title: 'Date',
      type: 'Date',
    });
    await dashboard.grid.column.create({
      title: 'Attachment',
      type: 'Attachment',
    });

    await dashboard.grid.addNewRow({
      index: 0,
    });
    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Number',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Number',
      text: '123',
    });
    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Checkbox',
    });

    const today = new Date().toISOString().slice(0, 10);
    await dashboard.grid.cell.date.open({
      index: 0,
      columnHeader: 'Date',
    });
    await dashboard.grid.cell.date.selectDate({
      date: today,
    });
    await dashboard.grid.cell.date.close();

    await dashboard.grid.cell.attachment.addFile({
      index: 0,
      columnHeader: 'Attachment',
      filePath: `${process.cwd()}/fixtures/sampleFiles/1.json`,
    });

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Title',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('Row 0');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Number',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('123');

    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'Checkbox',
      },
      { position: { x: 1, y: 1 } }
    );
    await new Promise(resolve => setTimeout(resolve, 5000));
    expect(await dashboard.grid.cell.getClipboardText()).toBe('true');

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Checkbox',
    });
    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'Checkbox',
      },
      { position: { x: 1, y: 1 } }
    );
    expect(await dashboard.grid.cell.getClipboardText()).toBe('false');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Date',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe(today);

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Attachment',
    });
    // expect(await dashboard.grid.cell.getClipboardText()).toBe('1.json');
  });
});
