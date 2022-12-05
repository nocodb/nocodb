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

  test('Clipboard support for cells', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.createTable({ title: 'Sheet1' });

    await dashboard.grid.column.create({
      title: 'SingleLineText',
      type: 'SingleLineText',
    });
    await dashboard.grid.column.create({
      title: 'LongText',
      type: 'LongText',
    });
    await dashboard.grid.column.create({
      title: 'Number',
      type: 'Number',
    });
    await dashboard.grid.column.create({
      title: 'PhoneNumber',
      type: 'PhoneNumber',
    });
    await dashboard.grid.column.create({
      title: 'Email',
      type: 'Email',
    });
    await dashboard.grid.column.create({
      title: 'URL',
      type: 'URL',
    });
    await dashboard.grid.column.create({
      title: 'Decimal',
      type: 'Decimal',
    });
    await dashboard.grid.column.create({
      title: 'Percent',
      type: 'Percent',
    });
    await dashboard.grid.column.create({
      title: 'Currency',
      type: 'Currency',
    });
    await dashboard.grid.column.create({
      title: 'Duration',
      type: 'Duration',
    });
    await dashboard.grid.column.create({
      title: 'Rating',
      type: 'Rating',
    });
    await dashboard.grid.column.create({
      title: 'SingleSelect',
      type: 'SingleSelect',
    });
    await dashboard.grid.column.create({
      title: 'MultiSelect',
      type: 'MultiSelect',
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

    // ########################################

    await dashboard.grid.addNewRow({
      index: 0,
    });
    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'SingleLineText',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'SingleLineText',
      text: 'SingleLineText',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'LongText',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'LongText',
      text: 'LongText',
    });

    await grid.cell.selectOption.select({ index: 0, columnHeader: 'SingleSelect', option: 'Option 1' });
    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 2',
      multiSelect: true,
    });
    await grid.cell.selectOption.select({
      index: 0,
      columnHeader: 'MultiSelect',
      option: 'Option 1',
      multiSelect: true,
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
      columnHeader: 'PhoneNumber',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'PhoneNumber',
      text: '987654321',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Email',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Email',
      text: 'test@example.com',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'URL',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'URL',
      text: 'nocodb.com',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Decimal',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Decimal',
      text: '1.1',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Percent',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Percent',
      text: '80',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Currency',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Currency',
      text: '20',
    });

    await dashboard.grid.cell.click({
      index: 0,
      columnHeader: 'Duration',
    });
    await dashboard.grid.cell.fillText({
      index: 0,
      columnHeader: 'Duration',
      text: '0008',
    });

    await dashboard.grid.cell.rating.select({
      index: 0,
      columnHeader: 'Rating',
      rating: 3,
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

    // ########################################

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'SingleLineText',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('SingleLineText');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'LongText',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('LongText');

    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'SingleSelect',
      },
      { position: { x: 1, y: 1 } }
    );
    expect(await dashboard.grid.cell.getClipboardText()).toBe('Option 1');

    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'MultiSelect',
      },
      { position: { x: 1, y: 1 } }
    );
    expect(await dashboard.grid.cell.getClipboardText()).toContain('Option 1');
    expect(await dashboard.grid.cell.getClipboardText()).toContain('Option 2');

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

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'PhoneNumber',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('987654321');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Email',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('test@example.com');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'URL',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('nocodb.com');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Decimal',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('1.1');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Percent',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('80');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Currency',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('20');

    await dashboard.grid.cell.copyToClipboard({
      index: 0,
      columnHeader: 'Duration',
    });
    expect(await dashboard.grid.cell.getClipboardText()).toBe('480');

    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'Rating',
      },
      { position: { x: 1, y: 1 } }
    );
    expect(await dashboard.grid.cell.getClipboardText()).toBe('4');

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

    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'Attachment',
      },
      { position: { x: 1, y: 1 } }
    );
    const attachmentsInfo = JSON.parse(await dashboard.grid.cell.getClipboardText());
    expect(attachmentsInfo[0]['title']).toBe('1.json');
  });
});
