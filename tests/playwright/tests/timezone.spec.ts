import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { Api, UITypes } from 'nocodb-sdk';
let api: Api<any>, records: any[];

const columns = [
  {
    column_name: 'Id',
    title: 'Id',
    uidt: UITypes.ID,
    ai: 1,
    pk: 1,
  },
  {
    column_name: 'DateTime',
    title: 'DateTime',
    uidt: UITypes.DateTime,
  },
];

const rowAttributes = [
  { Id: 1, DateTime: '2021-01-01 00:00:00' },
  { Id: 2, DateTime: '2021-01-01 04:00:00+04:00' },
  { Id: 3, DateTime: '2020-12-31 20:00:00-04:00' },
];

test.describe('Timezone : Europe/Berlin', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'dateTimeTable',
        title: 'dateTimeTable',
        columns: columns,
      });

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 10 });
    } catch (e) {
      console.error(e);
    }

    await page.reload();
  });

  test.use({
    locale: 'de-DE', // Change to German locale
    timezoneId: 'Europe/Berlin',
  });

  /*
   * This test is to verify the display value of DateTime column in the grid
   * when the timezone is set to Europe/Berlin
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected display values:
   *  Display value is converted to Europe/Berlin
   */
  test('API insert, verify display value', async () => {
    await dashboard.treeView.openTable({ title: 'dateTimeTable' });

    // DateTime inserted using API without timezone is converted to UTC
    // Display value is converted to Europe/Berlin
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-01-01 01:00' });

    // DateTime inserted using API with timezone is converted to UTC
    // Display value is converted to Europe/Berlin
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 01:00' });
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DateTime', value: '2021-01-01 01:00' });
  });

  /*
   * This test is to verify the API read response of DateTime column
   * when the timezone is set to Europe/Berlin
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected API response:
   *   API response is in UTC
   */

  test('API Insert, verify API read response', async () => {
    // UTC expected response
    const dateUTC = ['2021-01-01 00:00:00', '2021-01-01 00:00:00', '2021-01-01 00:00:00'];

    const readDate = records.list.map(record => record.DateTime);

    // expect API response to be in UTC
    expect(readDate).toEqual(dateUTC);
  });
});

// Change browser timezone & locale to Asia/Hong-Kong
//
test.describe('Timezone : Asia/Hong-kong', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'dateTimeTable',
        title: 'dateTimeTable',
        columns: columns,
      });

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
    } catch (e) {
      console.error(e);
    }

    await page.reload();
  });

  test.use({
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
  });

  /*
   * This test is to verify the display value of DateTime column in the grid
   * when the timezone is set to Asia/Hong-Kong
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected display values:
   *   Display value is converted to Asia/Hong-Kong
   */
  test('API inserted, verify display value', async () => {
    await dashboard.treeView.openTable({ title: 'dateTimeTable' });

    // DateTime inserted using API without timezone is converted to UTC
    // Display value is converted to Asia/Hong_Kong
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-01-01 08:00' });

    // DateTime inserted using API with timezone is converted to UTC
    // Display value is converted to Asia/Hong_Kong
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
  });
});

test.describe('Timezone', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.use({
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    // Using API for test preparation was not working
    // Hence switched over to UI based table creation

    await dashboard.treeView.createTable({ title: 'dateTimeTable' });
    await dashboard.grid.column.create({
      title: 'DateTime',
      type: 'DateTime',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
    });

    await dashboard.grid.cell.dateTime.setDateTime({
      index: 0,
      columnHeader: 'DateTime',
      dateTime: '2021-01-01 08:00:00',
    });

    // await dashboard.rootPage.reload();
  });

  /*
   * This test is to verify the display value & API response of DateTime column in the grid
   * when the value inserted is from the UI
   *
   * Note: Timezone for this test is set as Asia/Hong-Kong
   *
   * 1. Create table with DateTime column
   * 2. Insert DateTime value from UI '2021-01-01 08:00:00'
   * 3. Verify display value : should be '2021-01-01 08:00:00'
   * 4. Verify API response, expect UTC : should be '2021-01-01 00:00:00'
   *
   */
  test('Cell insert', async () => {
    // Verify stored value in database is UTC
    records = await api.dbTableRow.list('noco', context.project.id, 'dateTimeTable', { limit: 10 });
    const readDate = records.list[0].DateTime;
    // skip seconds from readDate
    // stored value expected to be in UTC
    expect(readDate.slice(0, 16)).toEqual('2021-01-01 00:00');

    // DateTime inserted from cell is converted to UTC & stored
    // Display value is same as inserted value
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
  });

  /*
   * This test is to verify the display value & API response of DateTime column in the grid
   * when the value inserted is from expanded record
   *
   * Note: Timezone for this test is set as Asia/Hong-Kong
   *
   * 1. Create table with DateTime column
   * 2. Insert DateTime value from UI '2021-01-01 08:00:00'
   * 3. Expand record & update DateTime value to '2021-02-02 12:30:00'
   * 4. Verify display value : should be '2021-02-02 12:30:00'
   * 5. Verify API response, expect UTC : should be '2021-02-02 04:30:00'
   *
   */
  test('Expanded record insert', async () => {
    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.fillField({
      columnTitle: 'DateTime',
      value: '2021-02-02 12:30:00',
      type: 'dateTime',
    });
    await dashboard.expandedForm.save();

    records = await api.dbTableRow.list('noco', context.project.id, 'dateTimeTable', { limit: 10 });
    const readDate = records.list[0].DateTime;
    // skip seconds from readDate
    // stored value expected to be in UTC
    expect(readDate.slice(0, 16)).toEqual('2021-02-02 04:30');

    // DateTime inserted from cell is converted to UTC & stored
    // Display value is same as inserted value
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-01-01 12:30' });
  });

  /*
   * This test is to verify the display value & API response of DateTime column in the grid
   * when the value inserted is from copy and paste
   *
   * Note: Timezone for this test is set as Asia/Hong-Kong
   *
   * 1. Create table with DateTime column
   * 2. Insert DateTime value from UI '2021-01-01 08:00:00'
   * 3. Add new row & copy and paste DateTime value to '2021-01-01 08:00:00'
   * 4. Verify display value : should be '2021-01-01 08:00:00'
   * 5. Verify API response, expect UTC : should be '2021-01-01 00:00:00'
   *
   */
  test('Copy paste', async () => {
    await dashboard.grid.addNewRow({ index: 1, columnHeader: 'Title', value: 'Copy paste test' });

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.grid.cell.copyToClipboard(
      {
        index: 0,
        columnHeader: 'DateTime',
      },
      { position: { x: 1, y: 1 } }
    );

    expect(await dashboard.grid.cell.getClipboardText()).toBe('2021-01-01 08:00');
    await dashboard.grid.cell.pasteFromClipboard({ index: 1, columnHeader: 'DateTime' });

    records = await api.dbTableRow.list('noco', context.project.id, 'dateTimeTable', { limit: 10 });
    const readDate = records.list[1].DateTime;
    // skip seconds from readDate
    // stored value expected to be in UTC
    expect(readDate.slice(0, 16)).toEqual('2021-01-01 00:00');

    // DateTime inserted from cell is converted to UTC & stored
    // Display value is same as inserted value
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
  });
});
