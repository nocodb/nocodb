import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { GridPage } from '../../pages/Dashboard/Grid';
import setup from '../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { keyPress } from '../utils/general';

let api: Api<any>;

test.describe('Verify shortcuts', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
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

  test.describe('Clipboard support', () => {
    const today = new Date().toISOString().slice(0, 10);

    async function verifyCellContents({ rowIndex }: { rowIndex: number }) {
      const responseTable = [
        { type: 'SingleLineText', value: 'SingleLineText' },
        { type: 'LongText', value: '"LongText"' },
        { type: 'SingleSelect', value: 'Option1' },
        { type: 'MultiSelect', value: 'Option1,Option2' },
        { type: 'Number', value: '123' },
        { type: 'PhoneNumber', value: '987654321' },
        { type: 'Email', value: 'test@example.com' },
        { type: 'URL', value: 'nocodb.com' },
        { type: 'Decimal', value: '1.12' },
        { type: 'Percent', value: '80' },
        { type: 'Currency', value: 20, options: { parseInt: true } },
        { type: 'Duration', value: 480, options: { parseInt: true } },
        { type: 'Rating', value: '4' },
        { type: 'Checkbox', value: 'true' },
        { type: 'Date', value: today },
        { type: 'Attachment', value: '1.json', options: { jsonParse: true } },
      ];

      for (const { type, value, options } of responseTable) {
        await dashboard.grid.cell.copyToClipboard(
          {
            index: rowIndex,
            columnHeader: type,
          },
          { position: { x: 1, y: 1 } }
        );
        if (options?.parseInt) {
          expect(parseInt(await dashboard.grid.cell.getClipboardText())).toBe(value);
        } else if (options?.jsonParse) {
          const attachmentsInfo = JSON.parse(await dashboard.grid.cell.getClipboardText());
          expect(attachmentsInfo[0]['title']).toBe('1.json');
        } else {
          expect(await dashboard.grid.cell.getClipboardText()).toBe(value);
        }
      }
    }

    test.beforeEach(async () => {
      api = new Api({
        baseURL: `http://localhost:8080/`,
        headers: {
          'xc-auth': context.token,
        },
      });

      const columns = [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleLineText',
          title: 'SingleLineText',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'LongText',
          title: 'LongText',
          uidt: UITypes.LongText,
        },
        {
          column_name: 'Number',
          title: 'Number',
          uidt: UITypes.Number,
        },
        {
          column_name: 'PhoneNumber',
          title: 'PhoneNumber',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Email',
          title: 'Email',
          uidt: UITypes.Email,
        },
        {
          column_name: 'URL',
          title: 'URL',
          uidt: UITypes.URL,
        },
        {
          column_name: 'Decimal',
          title: 'Decimal',
          uidt: UITypes.Decimal,
        },
        {
          column_name: 'Percent',
          title: 'Percent',
          uidt: UITypes.Percent,
        },
        {
          column_name: 'Currency',
          title: 'Currency',
          uidt: UITypes.Currency,
        },
        {
          column_name: 'Duration',
          title: 'Duration',
          uidt: UITypes.Duration,
        },
        {
          column_name: 'SingleSelect',
          title: 'SingleSelect',
          uidt: UITypes.SingleSelect,
          dtxp: "'Option1','Option2'",
        },
        {
          column_name: 'MultiSelect',
          title: 'MultiSelect',
          uidt: UITypes.MultiSelect,
          dtxp: "'Option1','Option2'",
        },
        {
          column_name: 'Rating',
          title: 'Rating',
          uidt: UITypes.Rating,
        },
        {
          column_name: 'Checkbox',
          title: 'Checkbox',
          uidt: UITypes.Checkbox,
        },
        {
          column_name: 'Date',
          title: 'Date',
          uidt: UITypes.Date,
        },
        {
          column_name: 'Attachment',
          title: 'Attachment',
          uidt: UITypes.Attachment,
        },
      ];

      const record = {
        Id: 1,
        SingleLineText: 'SingleLineText',
        LongText: 'LongText',
        SingleSelect: 'Option1',
        MultiSelect: 'Option1,Option2',
        Number: 123,
        PhoneNumber: '987654321',
        Email: 'test@example.com',
        URL: 'nocodb.com',
        Rating: 4,
        Decimal: 1.12,
        Percent: 80,
        Currency: 20,
        Duration: 480,
        Checkbox: 1,
        Date: today,
      };

      try {
        const project = await api.project.read(context.project.id);
        const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
          table_name: 'Sheet1',
          title: 'Sheet1',
          columns: columns,
        });

        await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, [record]);
        await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 1 });
      } catch (e) {
        console.error(e);
      }

      // reload page
      await dashboard.rootPage.reload();
      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });
      await dashboard.treeView.openTable({ title: 'Sheet1' });

      // ########################################

      await dashboard.grid.cell.attachment.addFile({
        index: 0,
        columnHeader: 'Attachment',
        filePath: `${process.cwd()}/fixtures/sampleFiles/1.json`,
      });
    });

    test('single cell- all data types', async () => {
      await verifyCellContents({ rowIndex: 0 });
    });

    test('multiple cells - horizontal, all data types', async ({ page }) => {
      // click first cell, press `Ctrl A` and `Ctrl C`
      await grid.cell.click({ index: 0, columnHeader: 'Id' });
      await page.keyboard.press((await grid.isMacOs()) ? 'Meta+a' : 'Control+a');
      await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');

      /////////////////////////////////////////////////////////////////////////

      // horizontal multiple cells selection : copy paste
      // add new row, click on first cell, paste
      await grid.addRowRightClickMenu(0, 'Id');
      await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');
      await verifyCellContents({ rowIndex: 1 });

      // reload page
      await dashboard.rootPage.reload();
      await dashboard.grid.verifyRowCount({ count: 2 });
    });

    test('multiple cells - vertical', async ({ page }) => {
      let cellText: string[] = ['aaa', 'bbb', 'ccc', 'ddd', 'eee'];
      for (let i = 1; i <= 5; i++) {
        await grid.addNewRow({ index: i, columnHeader: 'SingleLineText', value: cellText[i - 1] });
      }

      await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowDown');

      await keyPress(page, 'Meta+c');
      await grid.cell.click({ index: 1, columnHeader: 'LongText' });
      await keyPress(page, 'Meta+v');

      // reload page
      await dashboard.rootPage.reload();

      // verify copied data
      for (let i = 1; i <= 5; i++) {
        await grid.cell.verify({ index: i, columnHeader: 'LongText', value: cellText[i - 1] });
      }

      // Block selection
      await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowDown');
      await keyPress(page, 'Shift+ArrowRight');
      await keyPress(page, 'Meta+c');
      await grid.cell.click({ index: 4, columnHeader: 'SingleLineText' });
      await keyPress(page, 'Meta+v');

      // reload page
      await dashboard.rootPage.reload();

      // verify copied data
      for (let i = 4; i <= 5; i++) {
        await grid.cell.verify({ index: i, columnHeader: 'SingleLineText', value: cellText[i - 4] });
        await grid.cell.verify({ index: i, columnHeader: 'LongText', value: cellText[i - 4] });
      }

      /////////////////////////////////////////////////////////////////////////

      // Meta for block selection
      await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
      await keyPress(page, 'Shift+Meta+ArrowDown');
      await keyPress(page, 'Meta+c');
      await grid.cell.click({ index: 1, columnHeader: 'Email' });
      await keyPress(page, 'Meta+v');

      // reload page
      await dashboard.rootPage.reload();

      // verify copied data
      // modified cell text after previous block operation
      cellText = ['aaa', 'bbb', 'ccc', 'aaa', 'bbb'];
      for (let i = 1; i <= 5; i++) {
        await grid.cell.verify({ index: i, columnHeader: 'Email', value: cellText[i - 1] });
      }
    });
  });
});
