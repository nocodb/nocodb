import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { isEE } from '../../../setup/db';
import { getDefaultPwd } from '../../utils/general';
import config from '../../../playwright.config';

let api: Api<any>;

test.describe('Verify shortcuts', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    try {
      await api.auth.signup({
        email: 'new@example.com',
        password: getDefaultPwd(),
      });
    } catch (e) {
      // ignore error even if user already exists
    }

    if (isEE() && api['workspaceUser']) {
      try {
        await api['workspaceUser'].invite(context.workspace.id, {
          email: 'new@example.com',
          roles: 'workspace-level-creator',
        });
      } catch (e) {
        console.log(e);
      }
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('Verify shortcuts', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Country' });
    // create new table
    await page.keyboard.press('Alt+t');
    await dashboard.treeView.createTable({
      title: 'New Table',
      skipOpeningModal: true,
      baseTitle: context.base.title,
    });
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
    await grid.column.selectType({ type: UITypes.SingleLineText });
    await grid.column.save();
    await grid.column.verify({ title: 'New Column' });

    // fullscreen
    // to be implemented for hub
    // await page.keyboard.press('Alt+f');
    // await dashboard.treeView.verifyVisibility({
    //   isVisible: false,
    // });
    // await dashboard.viewSidebar.verifyVisibility({
    //   isVisible: false,
    // });
    // await page.keyboard.press('Alt+f');
    // await dashboard.treeView.verifyVisibility({
    //   isVisible: true,
    // });
    // await dashboard.viewSidebar.verifyVisibility({
    //   isVisible: true,
    // });

    // disabled temporarily for hub. Clipboard access to be fixed.
    // invite team member
    // await page.keyboard.press('Alt+i');
    // await dashboard.grid.toolbar.share.invite({ email: 'new@example.com', role: 'editor' });
    // const url = await dashboard.grid.toolbar.share.getInvitationUrl();
    // expect(url).toContain('signup');

    // Cmd + Right arrow
    await dashboard.treeView.openTable({ title: 'Country' });
    await page.waitForTimeout(1500);
    await grid.cell.click({ index: 0, columnHeader: 'Country' });
    await page.waitForTimeout(1500);
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowRight' : 'Control+ArrowRight');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Cities' });

    // Cmd + Right arrow
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowLeft' : 'Control+ArrowLeft');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' });

    // Cmd + up arrow
    await grid.cell.click({ index: 10, columnHeader: 'Country' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowUp' : 'Control+ArrowUp');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' });

    // Cmd + down arrow
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowDown' : 'Control+ArrowDown');

    await grid.cell.verifyCellActiveSelected({ index: 108, columnHeader: 'Country' });

    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+ArrowUp' : 'Control+ArrowUp');

    // Enter to edit and Esc to cancel
    await grid.cell.click({ index: 0, columnHeader: 'Country' });
    await page.keyboard.press('Enter');
    await page.keyboard.type('New');
    await page.keyboard.press('Escape');
    await grid.cell.verify({ index: 0, columnHeader: 'Country', value: 'AfghanistanNew' });

    // Space to open expanded row and Meta + Space to save
    await grid.cell.click({ index: 1, columnHeader: 'Country' });
    await page.keyboard.press('Space');

    await dashboard.expandedForm.fillField({ columnTitle: 'Country', value: 'NewAlgeria' });
    await dashboard.expandedForm.save();
    await dashboard.expandedForm.escape();
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+Enter' : 'Control+Enter');
    await page.reload();
    await grid.cell.verify({ index: 1, columnHeader: 'Country', value: 'NewAlgeria' });

    await grid.cell.click({ index: 14, columnHeader: 'Cities' });
    await page.keyboard.press('Tab');

    await grid.cell.click({ index: 15, columnHeader: 'Cities' });
    await page.keyboard.press('Tab');
    await grid.cell.verifyCellActiveSelected({ index: 16, columnHeader: 'Country' });

    await grid.cell.click({ index: 15, columnHeader: 'Country' });
    await page.keyboard.press('Shift+Tab');
    await grid.cell.verifyCellActiveSelected({ index: 14, columnHeader: 'Cities' });

    await grid.cell.click({ index: 0, columnHeader: 'Country' });
    await page.keyboard.press('Shift+Tab');
    await grid.cell.verifyCellActiveSelected({ index: 0, columnHeader: 'Country' });
  });
});

test.describe('Clipboard support', () => {
  const today = new Date().toISOString().slice(0, 10);
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      { column_name: 'Id', uidt: UITypes.ID },
      { column_name: 'SingleLineText', uidt: UITypes.SingleLineText },
      { column_name: 'LongText', uidt: UITypes.LongText },
      { column_name: 'Number', uidt: UITypes.Number },
      { column_name: 'PhoneNumber', uidt: UITypes.PhoneNumber },
      { column_name: 'Email', uidt: UITypes.Email },
      { column_name: 'URL', uidt: UITypes.URL },
      { column_name: 'Decimal', uidt: UITypes.Decimal },
      { column_name: 'Percent', uidt: UITypes.Percent },
      { column_name: 'Currency', uidt: UITypes.Currency },
      { column_name: 'Duration', uidt: UITypes.Duration },
      { column_name: 'SingleSelect', uidt: UITypes.SingleSelect, dtxp: "'Option1','Option2'" },
      { column_name: 'MultiSelect', uidt: UITypes.MultiSelect, dtxp: "'Option1','Option2'" },
      { column_name: 'Rating', uidt: UITypes.Rating },
      { column_name: 'Checkbox', uidt: UITypes.Checkbox },
      { column_name: 'Date', uidt: UITypes.Date, meta: { date_format: 'YYYY-MM-DD' } },
      { column_name: 'Attachment', uidt: UITypes.Attachment },
    ];

    const record = {
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
      const base = await api.base.read(context.base.id);
      const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'Sheet1',
        title: 'Sheet1',
        columns: columns,
      });

      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, [record]);
      await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 1 });
    } catch (e) {
      console.error(e);
    }

    // reload page
    await dashboard.rootPage.reload();
    await dashboard.treeView.openTable({ title: 'Sheet1' });

    // ########################################

    await dashboard.grid.renderColumn('Attachment');

    await dashboard.grid.cell.attachment.addFile({
      index: 0,
      columnHeader: 'Attachment',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/1.json`],
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function verifyCellContents({ rowIndex }: { rowIndex: number }) {
    const responseTable = [
      { type: 'SingleLineText', value: 'SingleLineText' },
      { type: 'LongText', value: 'LongText' },
      { type: 'SingleSelect', value: 'Option1' },
      { type: 'MultiSelect', value: `Option1Option2` },
      { type: 'Number', value: '123' },
      { type: 'PhoneNumber', value: '987654321' },
      { type: 'Email', value: 'test@example.com' },
      { type: 'URL', value: 'nocodb.com' },
      { type: 'Decimal', value: '1.1' },
      { type: 'Percent', value: '80' },
      { type: 'Currency', value: 20 },
      { type: 'Duration', value: '00:08' },
      { type: 'Rating', value: 4 },
      { type: 'Checkbox', value: 'true' },
      { type: 'Date', value: today },
      { type: 'Attachment', value: 1 },
    ];

    for (const { type, value } of responseTable) {
      await dashboard.grid.renderColumn(type);
      if (type === 'Rating') {
        await dashboard.grid.cell.rating.verify({
          index: rowIndex,
          columnHeader: type,
          rating: value,
        });
      } else if (type === 'Checkbox') {
        await dashboard.grid.cell.checkbox.verifyChecked({
          index: rowIndex,
          columnHeader: type,
        });
      } else if (type === 'Date') {
        await dashboard.grid.cell.date.verify({
          index: rowIndex,
          columnHeader: type,
          date: value,
        });
      } else if (type === 'Attachment') {
        await dashboard.grid.cell.attachment.verifyFileCount({
          index: rowIndex,
          columnHeader: type,
          count: value,
        });
      } else {
        await dashboard.grid.cell.verify({
          index: rowIndex,
          columnHeader: type,
          value,
        });
      }
    }
  }

  async function verifyClipContents({ rowIndex }: { rowIndex: number }) {
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
      await dashboard.grid.cell.copyCellToClipboard(
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

  test('single cell- all data types', async () => {
    await verifyClipContents({ rowIndex: 0 });
  });

  test('multiple cells - horizontal, all data types', async ({ page }) => {
    // skip for local run (clipboard access issue in headless mode)
    // Cmd A or Control A support is removed
    test.skip();
    if (!process.env.CI && config.use.headless) {
      test.skip();
    }

    // click first cell, press `Ctrl A` and `Ctrl C`
    await grid.cell.click({ index: 0, columnHeader: 'Id' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+a' : 'Control+a');
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');

    /////////////////////////////////////////////////////////////////////////

    // horizontal multiple cells selection : copy paste
    // add new row, click on first cell, paste
    await grid.addNewRow({ index: 1, columnHeader: 'SingleLineText', value: 'aaa' });
    await dashboard.rootPage.waitForTimeout(1000);
    await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');
    await verifyCellContents({ rowIndex: 1 });

    // reload page
    await dashboard.rootPage.reload();
    await dashboard.grid.verifyRowCount({ count: 2 });
  });

  test('multiple cells - vertical', async ({ page }) => {
    // skip for local run (clipboard access issue in headless mode)
    if (!process.env.CI && config.use.headless) {
      test.skip();
    }

    let cellText: string[] = ['aaa', 'bbb', 'ccc', 'ddd', 'eee'];
    for (let i = 1; i <= 5; i++) {
      await grid.addNewRow({ index: i, columnHeader: 'SingleLineText', value: cellText[i - 1] });
    }

    await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await page.waitForTimeout(500);

    await grid.cell.click({ index: 1, columnHeader: 'LongText' });
    await page.waitForTimeout(500);

    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // verify copied data
    for (let i = 1; i <= 5; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'LongText', value: cellText[i - 1] });
    }

    // Block selection
    await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(500);

    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await page.waitForTimeout(500);

    await grid.cell.click({ index: 4, columnHeader: 'SingleLineText' });
    await page.waitForTimeout(500);

    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    await page.waitForTimeout(1000);

    await grid.expandTableOverlay.upsert();

    await page.waitForTimeout(1000);

    // reload page
    // verify copied data
    for (let i = 4; i <= 5; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'SingleLineText', value: cellText[i - 4] });
      await grid.cell.verify({ index: i, columnHeader: 'LongText', value: cellText[i - 4] });
    }

    /////////////////////////////////////////////////////////////////////////

    // Meta for block selection
    await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
    await page.keyboard.press(`Shift+${(await grid.isMacOs()) ? 'Meta' : 'Control'}+ArrowDown`);
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await grid.cell.click({ index: 1, columnHeader: 'Email' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // reload page
    await dashboard.rootPage.reload();

    // verify copied data
    // modified cell text after previous block operation
    cellText = ['aaa', 'bbb', 'ccc', 'aaa', 'bbb'];
    for (let i = 1; i <= 5; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'Email', value: cellText[i - 1] });
    }

    // One copy, multiple paste
    await grid.cell.click({ index: 0, columnHeader: 'SingleLineText' });
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await grid.cell.click({ index: 1, columnHeader: 'SingleLineText' });
    await page.keyboard.press(`Shift+${(await grid.isMacOs()) ? 'Meta' : 'Control'}+ArrowDown`);
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // reload page
    await dashboard.rootPage.reload();

    // verify copied data
    for (let i = 1; i <= 5; i++) {
      await grid.cell.verify({ index: i, columnHeader: 'SingleLineText', value: 'SingleLineText' });
    }
  });
});
