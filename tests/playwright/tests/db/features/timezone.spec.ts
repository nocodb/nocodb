import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { Api, PaginatedType, ProjectListType, UITypes } from 'nocodb-sdk';
import { enableQuickRun, isEE, isMysql, isPg, isSqlite } from '../../../setup/db';
import { getKnexConfig } from '../../utils/config';
import { getBrowserTimezoneOffset } from '../../utils/general';
import config from '../../../playwright.config';
import { createTableWithDateTimeColumn, mysqlTz } from '../../../setup/knexHelper';

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

async function timezoneSuite(baseTitle: string, context: NcContext, skipTableCreate?: boolean) {
  const api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });
  // get current workspace information if in hub
  const workspaceId = context?.workspace?.id;
  try {
    let baseList: ProjectListType;
    if (isEE() && api['workspaceBase']) {
      baseList = await api['workspaceBase'].list(workspaceId);
    } else {
      baseList = await api.base.list();
    }
    for (const base of baseList.list) {
      // delete base with title 'xcdb' if it exists
      if (base.title === baseTitle) {
        await api.base.delete(base.id);
      }
    }
  } catch (e) {
    console.log(e);
  }

  const base = await api.base.create({ title: baseTitle, fk_workspace_id: workspaceId, type: 'database' });

  if (skipTableCreate) return { base, api };
  const table = await api.source.tableCreate(base.id, base.sources?.[0].id, {
    table_name: 'dateTimeTable',
    title: 'dateTimeTable',
    columns: columns,
  });
  return { base, table, api };
}

// with appropriate credentials, connect to external db
//
async function connectToExtDb(context: any, dbName: string, api: Api<any>) {
  if (isPg(context)) {
    await api.source.create(context.base.id, {
      alias: dbName,
      type: 'pg',
      config: getKnexConfig({ dbName, dbType: 'pg' }),
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    });
  } else if (isMysql(context)) {
    await api.source.create(context.base.id, {
      alias: dbName,
      type: 'mysql2',
      config: getKnexConfig({ dbName, dbType: 'mysql' }),
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    });
  } else if (isSqlite(context)) {
    await api.source.create(context.base.id, {
      alias: dbName,
      type: 'sqlite3',
      config: {
        client: 'sqlite3',
        connection: {
          client: 'sqlite3',
          database: dbName,
          connection: {
            filename: `../../tests/playwright/${dbName}.sqlite3`,
          },
          useNullAsDefault: true,
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    });
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////

// serial : as we are creating an external db, we need to run the tests sequentially
test.describe.serial('Timezone-XCDB : Japan/Tokyo', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let api: Api<any>, records: any[];
  let context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    if (!isSqlite(context)) return;

    try {
      const { base, table, api } = await timezoneSuite(`xcdb${context.workerId}`, context);

      await api.dbTableRow.bulkCreate('noco', base.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', base.id, table.id, { limit: 10 });
    } catch (e) {
      console.error(e);
    }

    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // DST independent test
  test.use({
    locale: 'ja-JP', // Change to Japanese locale
    timezoneId: 'Asia/Tokyo', // Set timezone to Tokyo timezone
  });

  /*
   * This test is to verify the display value of DateTime column in the grid
   * when the timezone is set to Asia/Tokyo (UTC+9)
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone (treated as UTC)
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected display values:
   *  Display value is converted to Asia/Tokyo
   */
  test('API insert, verify display value', async () => {
    if (!isSqlite(context)) return;

    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });
    await dashboard.treeView.openTable({ title: 'dateTimeTable' });

    // DateTime inserted using API without timezone is converted to db-timezone (server timezone in case of sqlite)
    // Display value is converted to Asia/Tokyo
    const dateInserted = new Date(`2021-01-01 00:00:00${getBrowserTimezoneOffset()}`);
    // convert dateInserted to Japan/Tokyo timezone in YYYY-MM-DD HH:mm format
    const dateInsertedInJapan = new Date(dateInserted.getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');

    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: dateInsertedInJapan });

    // DateTime inserted using API with timezone is converted to UTC
    // Display value is converted to Asia/Tokyo
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 09:00' });
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DateTime', value: '2021-01-01 09:00' });
  });

  /*
   * This test is to verify the API read response of DateTime column
   * when the timezone is set to Asia/Tokyo (UTC+9)
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone (treated as UTC)
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected API response:
   *   API response is in UTC
   */

  test('API Insert, verify API read response', async () => {
    if (!isSqlite(context)) return;

    const dateInserted = new Date(`2021-01-01 00:00:00${getBrowserTimezoneOffset()}`);
    // translate dateInserted to UTC in YYYY-MM-DD HH:mm format
    const dateInsertedInUTC = dateInserted.toISOString().replace('T', ' ').replace('Z', '');

    // UTC expected response
    const dateUTC = [
      `${dateInsertedInUTC.slice(0, 19)}+00:00`,
      '2021-01-01 00:00:00+00:00',
      '2021-01-01 00:00:00+00:00',
    ];

    const readDate = records.list.map(record => record.DateTime);

    // expect API response to be in UTC
    expect(readDate).toEqual(dateUTC);
  });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Change browser timezone & locale to Asia/Hong-Kong
//
test.describe.serial('Timezone-XCDB : Asia/Hong-kong', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    try {
      const { base, table, api } = await timezoneSuite(`xcdb${context.workerId}`, context);
      await dashboard.rootPage.reload();

      await api.dbTableRow.bulkCreate('noco', base.id, table.id, rowAttributes);
    } catch (e) {
      console.error(e);
    }

    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.use({
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
  });

  /*
   * This test is to verify the display value of DateTime column in the grid
   * when the timezone is set to Asia/Hong-Kong (UTC+8)
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone (treated as UTC)
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected display values:
   *   Display value is converted to Asia/Hong-Kong
   */
  test('API insert, verify display value', async () => {
    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });
    await dashboard.treeView.openTable({ title: 'dateTimeTable' });

    // DateTime inserted using API without timezone is converted to UTC
    // Display value is converted to Asia/Hong_Kong
    const dateInserted = new Date(`2021-01-01 00:00:00${getBrowserTimezoneOffset()}`);
    // convert dateInserted to Asia/Hong-kong timezone using offset
    const dateInsertedInHK = new Date(dateInserted.getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');

    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DateTime',
      value: dateInsertedInHK,
    });

    // DateTime inserted using API with timezone is converted to UTC
    // Display value is converted to Asia/Hong_Kong
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
  });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////

test.describe.serial('Timezone-XCDB : Asia/Hong-kong', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let gApi: Api<any>, records: any[];
  let context: any;
  test.use({
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    const { base, api } = await timezoneSuite(`xcdb${context.workerId}`, context, true);
    gApi = api;
    await dashboard.rootPage.reload();

    context.base = base;

    // Kludge: Using API for test preparation was not working
    // Hence switched over to UI based table creation

    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.createTable({
      title: 'dateTimeTable',
      mode: 'Xcdb',
      baseTitle: context.base.title,
      skipOpeningModal: false,
    });
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
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  /*
   * This test is to verify the display value & API response of DateTime column in the grid
   * when the value inserted is from the UI
   *
   * Note: Timezone for this test is set as Asia/Hong-Kong (UTC+8)
   *
   * 1. Create table with DateTime column
   * 2. Insert DateTime value from UI '2021-01-01 08:00:00'
   * 3. Verify display value : should be '2021-01-01 08:00:00'
   * 4. Verify API response, expect UTC : should be '2021-01-01 00:00:00'
   *
   */
  test('Cell insert', async () => {
    // Verify stored value in database is UTC
    records = await gApi.dbTableRow.list('noco', context.base.id, 'dateTimeTable', { limit: 10 });

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

    records = await gApi.dbTableRow.list('noco', context.base.id, 'dateTimeTable', { limit: 10 });
    const readDate = records.list[0].DateTime;
    // skip seconds from readDate
    // stored value expected to be in UTC
    expect(readDate.slice(0, 16)).toEqual('2021-02-02 04:30');

    // DateTime inserted from cell is converted to UTC & stored
    // Display value is same as inserted value
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-02-02 12:30' });
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
    // skip for local run (clipboard access issue in headless mode)
    if (process.env.CI === undefined && config.use.headless) {
      test.skip();
      return;
    }
    await dashboard.grid.addNewRow({ index: 1, columnHeader: 'Title', value: 'Copy paste test' });

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.grid.cell.copyCellToClipboard(
      {
        index: 0,
        columnHeader: 'DateTime',
      },
      { position: { x: 1, y: 1 } }
    );

    expect(await dashboard.grid.cell.getClipboardText()).toBe('2021-01-01 08:00');
    await dashboard.grid.cell.pasteFromClipboard({ index: 1, columnHeader: 'DateTime' });

    records = await gApi.dbTableRow.list('noco', context.base.id, 'dateTimeTable', { limit: 10 });
    expect(records.list.length).toBe(2);
    const readDate = records.list[1].DateTime;
    // skip seconds from readDate
    // stored value expected to be in UTC
    expect(readDate.slice(0, 16)).toEqual('2021-01-01 00:00');

    // DateTime inserted from cell is converted to UTC & stored
    // Display value is same as inserted value
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 08:00' });
  });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getDateTimeInLocalTimeZone(dateString: string) {
  // create a Date object with the input string
  // assumes local system timezone
  const date = new Date(dateString);

  // get the timezone offset in minutes and convert to milliseconds
  // subtract the offset from the provided time in milliseconds for IST
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  // adjust the date by the offset
  const adjustedDate = new Date(date.getTime() - offsetMs);

  // format the adjusted date as a string in the desired format
  const outputString = adjustedDate.toISOString().slice(0, 16).replace('T', ' ');

  // output the result
  return outputString;
}

// sample
//  input:    2021-01-01 10:00:00+05:30
//  output:   2021-01-01 04:30:00+00:00
function getDateTimeInUTCTimeZone(dateString: string) {
  // create a Date object with the input string
  const adjustedDate = new Date(dateString);

  // format the adjusted date as a string in the desired format
  const outputString = adjustedDate.toISOString().slice(0, 19).replace('T', ' ');

  // output the result
  return `${outputString}+00:00`;
}

test.describe.serial('Timezone- ExtDB : DateTime column, Browser Timezone same as server timezone', async () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let api: Api<any>;
  let context: any;
  let counter = 0;

  const expectedDisplayValues = {
    pg: {
      // PG ignores timezone information for datetime without timezone
      DatetimeWithoutTz: [
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+00:00'),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+00:00'),
      ],
      // PG stores datetime with timezone information in UTC
      DatetimeWithTz: [
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+00:00'),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+05:30'),
      ],
    },
    sqlite: {
      // without +HH:MM information, display value is same as inserted value
      // with +HH:MM information, display value is converted to browser timezone
      // SQLite doesn't have with & without timezone fields; both are same in this case
      DatetimeWithoutTz: [
        getDateTimeInLocalTimeZone(`2023-04-27 10:00:00`),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+05:30'),
      ],
      DatetimeWithTz: [
        getDateTimeInLocalTimeZone(`2023-04-27 10:00:00`),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+05:30'),
      ],
    },
    mysql: {
      DatetimeWithoutTz: [
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+00:00'),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+05:30'),
      ],
      DatetimeWithTz: [
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+00:00'),
        getDateTimeInLocalTimeZone('2023-04-27 10:00:00+05:30'),
      ],
    },
  };

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    counter++;
    await createTableWithDateTimeColumn(context.dbType, `datetimetable01${counter}`);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // ExtDB : DateAdd, DateTime_Diff verification
  //  - verify display value
  //  - verify API response value
  //
  test('Formula, verify display value', async () => {
    await connectToExtDb(context, `datetimetable01${counter}`, api);
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    // insert a record to work with formula experiments
    //
    await dashboard.treeView.openBase({ title: `datetimetable01${counter}` });
    await dashboard.treeView.openTable({ title: 'MyTable' });

    // Create formula column (dummy)
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const table = await api.dbTable.list(context.base.id);
    let table_data: any;
    table_data = await api.dbTableColumn.create(table.list.find(x => x.title === 'MyTable').id, {
      title: 'formula-1',
      uidt: UITypes.Formula,
      formula_raw: '0',
    });
    table_data = await api.dbTableColumn.create(table.list.find(x => x.title === 'MyTable').id, {
      title: 'formula-2',
      uidt: UITypes.Formula,
      formula_raw: '0',
    });

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    // Insert new row
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      dateTime: '2023-04-27 10:00:00',
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      dateTime: '2023-04-27 10:00:00',
    });

    // verify display value
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DatetimeWithTz', value: '2023-04-27 10:00' });
    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });

    async function verifyFormula({
      formula,
      expectedDisplayValue,
      verifyApiResponse = true,
    }: {
      formula: string[];
      expectedDisplayValue: string[];
      verifyApiResponse?: boolean;
    }) {
      try {
        await api.dbTableColumn.update(table_data.columns[3].id, {
          title: 'formula-1',
          column_name: 'formula-1',
          uidt: UITypes.Formula,
          formula_raw: formula[0],
        });
        await dashboard.rootPage.waitForTimeout(1000);
        await api.dbTableColumn.update(table_data.columns[4].id, {
          title: 'formula-2',
          column_name: 'formula-2',
          uidt: UITypes.Formula,
          formula_raw: formula[1],
        });
      } catch (e) {
        console.log('formula column create', e);
      }

      // reload page
      await dashboard.rootPage.reload();
      await dashboard.rootPage.waitForTimeout(2000);

      await dashboard.grid.cell.verify({
        index: 2,
        columnHeader: 'formula-1',
        value: expectedDisplayValue[0],
      });
      await dashboard.grid.cell.verify({
        index: 2,
        columnHeader: 'formula-2',
        value: expectedDisplayValue[1],
      });

      // verify API response
      if (verifyApiResponse) {
        let records;
        try {
          records = await api.dbTableRow.list('noco', context.base.id, table_data.id, { limit: 10 });
        } catch (e) {
          console.log('api.dbTableRow.list', e);
        }

        const formattedOffset = getBrowserTimezoneOffset();

        // set seconds to 00 for comparison (API response has non zero seconds)
        let record = records.list[2]['formula-1'];
        const formula_1 = record.substring(0, 17) + '00' + record.substring(19);
        expect(formula_1).toEqual(getDateTimeInUTCTimeZone(`${expectedDisplayValue[0]}${formattedOffset}`));

        record = records.list[2]['formula-2'];
        const formula_2 = record.substring(0, 17) + '00' + record.substring(19);
        expect(formula_2).toEqual(getDateTimeInUTCTimeZone(`${expectedDisplayValue[1]}${formattedOffset}`));
      }
    }

    // verify display value for formula columns (formula-1, formula-2)
    // source data : ['2023-04-27 10:00', '2023-04-27 10:00']
    await verifyFormula({
      formula: ['DATEADD(DatetimeWithoutTz, 1, "day")', 'DATEADD(DatetimeWithTz, 1, "day")'],
      expectedDisplayValue: ['2023-04-28 10:00', '2023-04-28 10:00'],
    });

    await verifyFormula({
      formula: ['DATEADD(DatetimeWithoutTz, 1, "month")', 'DATEADD(DatetimeWithTz, 1, "month")'],
      expectedDisplayValue: ['2023-05-27 10:00', '2023-05-27 10:00'],
    });

    await verifyFormula({
      formula: ['DATEADD(DatetimeWithoutTz, 1, "year")', 'DATEADD(DatetimeWithTz, 1, "year")'],
      expectedDisplayValue: ['2024-04-27 10:00', '2024-04-27 10:00'],
    });

    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      dateTime: '2024-04-27 10:00:00',
    });

    await verifyFormula({
      formula: [
        'DATETIME_DIFF({DatetimeWithoutTz}, {DatetimeWithTz}, "days")',
        'DATETIME_DIFF({DatetimeWithTz}, {DatetimeWithoutTz}, "days")',
      ],
      expectedDisplayValue: ['-366', '366'],
      verifyApiResponse: false,
    });

    await verifyFormula({
      formula: [
        'DATETIME_DIFF({DatetimeWithoutTz}, {DatetimeWithTz}, "months")',
        'DATETIME_DIFF({DatetimeWithTz}, {DatetimeWithoutTz}, "months")',
      ],
      expectedDisplayValue: ['-12', '12'],
      verifyApiResponse: false,
    });
  });

  test('Verify display value, UI insert, API response', async () => {
    await connectToExtDb(context, `datetimetable01${counter}`, api);
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    // get timezone offset
    const formattedOffset = getBrowserTimezoneOffset();

    await dashboard.treeView.openBase({ title: `datetimetable01${counter}` });
    await dashboard.treeView.openTable({ title: 'MyTable' });

    if (isSqlite(context)) {
      // For SQLite, we assume that the browser timezone is the same as the server timezone
      //
      expectedDisplayValues['sqlite'].DatetimeWithoutTz[0] = getDateTimeInLocalTimeZone(
        `2023-04-27 10:00:00${formattedOffset}`
      );
      expectedDisplayValues['sqlite'].DatetimeWithTz[0] = getDateTimeInLocalTimeZone(
        `2023-04-27 10:00:00${formattedOffset}`
      );
    }

    // display value for datetime column without tz should be same as stored value
    // display value for datetime column with tz should be converted to browser timezone (HK in this case)
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithoutTz',
      value: expectedDisplayValues[context.dbType].DatetimeWithoutTz[0],
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithoutTz',
      value: expectedDisplayValues[context.dbType].DatetimeWithoutTz[1],
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithTz',
      value: expectedDisplayValues[context.dbType].DatetimeWithTz[0],
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithTz',
      value: expectedDisplayValues[context.dbType].DatetimeWithTz[1],
    });

    // Insert new row
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      dateTime: '2023-04-27 10:00:00',
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      dateTime: '2023-04-27 10:00:00',
    });

    // reload page & verify if inserted values are shown correctly
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      value: '2023-04-27 10:00',
    });

    // verify API response
    // Note that, for UI inserted records - second part of datetime may be non-zero (though not shown in UI)
    // Hence, we skip seconds from API response
    //

    const records = (await api.dbTableRow.list('noco', context.base.id, 'MyTable', { limit: 10 })) as {
      list: Record<string, any>[];
      pageInfo: PaginatedType;
    };
    records.list = records.list.filter(record => record.DatetimeWithoutTz && record.DatetimeWithTz);
    let dateTimeWithoutTz = records.list.map(record => record.DatetimeWithoutTz);
    let dateTimeWithTz = records.list.map(record => record.DatetimeWithTz);

    let expectedDateTimeWithoutTz = [];
    let expectedDateTimeWithTz = [];

    if (isSqlite(context)) {
      expectedDateTimeWithoutTz = [
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
        getDateTimeInUTCTimeZone('2023-04-27 10:00:00+05:30'),
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
      expectedDateTimeWithTz = [
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
        getDateTimeInUTCTimeZone('2023-04-27 10:00:00+05:30'),
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
    } else if (isPg(context)) {
      expectedDateTimeWithoutTz = [
        '2023-04-27 10:00:00+00:00',
        '2023-04-27 10:00:00+00:00',
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
      expectedDateTimeWithTz = [
        '2023-04-27 10:00:00+00:00',
        '2023-04-27 04:30:00+00:00',
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
    } else if (isMysql(context)) {
      expectedDateTimeWithoutTz = [
        '2023-04-27 10:00:00+00:00',
        '2023-04-27 04:30:00+00:00',
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
      expectedDateTimeWithTz = [
        '2023-04-27 10:00:00+00:00',
        '2023-04-27 04:30:00+00:00',
        getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
      ];
    }

    // reset seconds to 00 using string functions in dateTimeWithoutTz
    dateTimeWithoutTz = dateTimeWithoutTz.map(
      dateTimeString => dateTimeString.substring(0, 17) + '00' + dateTimeString.substring(19)
    );
    dateTimeWithTz = dateTimeWithTz.map(
      dateTimeString => dateTimeString.substring(0, 17) + '00' + dateTimeString.substring(19)
    );

    expect(dateTimeWithoutTz).toEqual(expectedDateTimeWithoutTz);
    expect(dateTimeWithTz).toEqual(expectedDateTimeWithTz);
  });
});

test.describe.serial('Timezone- ExtDB : DateTime column, Browser Timezone set to HKT', async () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let api: Api<any>;
  let context: any;
  test.use({
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    await createTableWithDateTimeColumn(context.dbType, 'datetimetable02');
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // ExtDB : DateAdd, DateTime_Diff verification
  //  - verify display value
  //  - verify API response value
  //
  test('Formula, verify display value', async () => {
    await connectToExtDb(context, 'datetimetable02', api);
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    // insert a record to work with formula experiments
    //
    await dashboard.treeView.openBase({ title: 'datetimetable02' });
    await dashboard.treeView.openTable({ title: 'MyTable' });
    // Insert new row
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      dateTime: '2023-04-27 12:30:00',
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      dateTime: '2023-04-27 12:30:00',
    });

    // Create formula column (dummy)
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const table = await api.dbTable.list(context.base.id);
    let table_data: any;
    table_data = await api.dbTableColumn.create(table.list.find(x => x.title === 'MyTable').id, {
      title: 'formula-1',
      uidt: UITypes.Formula,
      formula_raw: 'DATEADD(DatetimeWithoutTz, 1, "day")',
    });
    table_data = await api.dbTableColumn.create(table.list.find(x => x.title === 'MyTable').id, {
      title: 'formula-2',
      uidt: UITypes.Formula,
      formula_raw: 'DATEADD(DatetimeWithTz, 1, "day")',
    });
    // reload page
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    const records = await api.dbTableRow.list('noco', context.base.id, table_data.id, { limit: 10 });
    const formattedOffset = '+08:00';

    // Note that, for SQLite ExtDB connection, the timezone if not specified in the datetime string, it will be server timezone
    // getBrowserTimezoneOffset() in this case actually returns server timezone offset
    // Browser timezone is HKT
    const sqliteDate = new Date(`2023-04-28 10:00:00${getBrowserTimezoneOffset()}`);
    // convert sqliteDate to UTC
    const sqliteDateUTC = new Date(sqliteDate.getTime()).toISOString();
    // convert sqliteDateUTC to HKT
    const sqliteDateHKT = new Date(sqliteDateUTC).setHours(sqliteDate.getHours() + 8);
    // print sqliteDateHKT in YYYY-MM-DD HH:MM format
    const sqliteDateHKTString = new Date(sqliteDateHKT).toISOString().substring(0, 16).replace('T', ' ');

    const expectedValues = {
      pg: [
        { 'formula-1': '2023-04-28 18:00', 'formula-2': '2023-04-28 18:00' },
        { 'formula-1': '2023-04-28 18:00', 'formula-2': '2023-04-28 12:30' },
        { 'formula-1': '2023-04-28 12:30', 'formula-2': '2023-04-28 12:30' },
      ],
      mysql: [
        { 'formula-1': '2023-04-28 18:00', 'formula-2': '2023-04-28 18:00' },
        { 'formula-1': '2023-04-28 12:30', 'formula-2': '2023-04-28 12:30' },
        { 'formula-1': '2023-04-28 12:30', 'formula-2': '2023-04-28 12:30' },
      ],
      sqlite: [
        {
          'formula-1': sqliteDateHKTString,
          'formula-2': sqliteDateHKTString,
        },
        { 'formula-1': '2023-04-28 12:30', 'formula-2': '2023-04-28 12:30' },
        { 'formula-1': '2023-04-28 12:30', 'formula-2': '2023-04-28 12:30' },
      ],
    };

    // verify display value
    for (let index = 0; index < 3; index++) {
      await dashboard.grid.cell.verify({
        index,
        columnHeader: 'formula-1',
        value: expectedValues[context.dbType][index]['formula-1'],
      });
      await dashboard.grid.cell.verify({
        index,
        columnHeader: 'formula-2',
        value: expectedValues[context.dbType][index]['formula-2'],
      });

      // set seconds to 00 for comparison (API response has non zero seconds)
      let record = records.list[index]['formula-1'];
      const formula_1 = record.substring(0, 17) + '00' + record.substring(19);
      expect(formula_1).toEqual(
        getDateTimeInUTCTimeZone(`${expectedValues[context.dbType][index]['formula-1']}${formattedOffset}`)
      );

      record = records.list[index]['formula-2'];
      const formula_2 = record.substring(0, 17) + '00' + record.substring(19);
      expect(formula_2).toEqual(
        getDateTimeInUTCTimeZone(`${expectedValues[context.dbType][index]['formula-2']}${formattedOffset}`)
      );
    }
  });
});

test.describe.serial('Timezone- ExtDB (MySQL Only) : DB Timezone configured as HKT', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let api: Api<any>;
  let context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    // for PG, we need to restart server after reconfiguring timezone in .conf file
    // SQLite, does not support timezone configuration
    if (!isMysql(context)) {
      return;
    }

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    await createTableWithDateTimeColumn(context.dbType, 'datetimetable03', true);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.afterEach(async () => {
    if (isMysql(context)) {
      // Reset DB Timezone
      await mysqlTz();
    }
  });

  test('Verify display value, UI Insert, API response', async () => {
    if (!isMysql(context)) {
      return;
    }

    // get timezone offset
    const formattedOffset = getBrowserTimezoneOffset();

    // connect after timezone is set
    await connectToExtDb(context, 'datetimetable03', api);

    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    await dashboard.treeView.openBase({ title: 'datetimetable03' });
    await dashboard.treeView.openTable({ title: 'MyTable' });

    // display value for datetime column without tz should be same as stored value
    // display value for datetime column with tz should be converted to browser timezone (HK in this case)
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithoutTz',
      value: getDateTimeInLocalTimeZone('2023-04-27 10:00+08:00'),
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithoutTz',
      value: getDateTimeInLocalTimeZone('2023-04-27 10:00+05:30'),
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithTz',
      value: getDateTimeInLocalTimeZone('2023-04-27 10:00+08:00'),
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithTz',
      value: getDateTimeInLocalTimeZone('2023-04-27 10:00+05:30'),
    });

    // Insert new row
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      dateTime: '2023-04-27 10:00:00',
    });
    await dashboard.grid.cell.dateTime.setDateTime({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      dateTime: '2023-04-27 10:00:00',
    });

    // reload page & verify if inserted values are shown correctly
    await dashboard.rootPage.reload();
    await dashboard.rootPage.waitForTimeout(2000);

    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      value: '2023-04-27 10:00',
    });

    // verify API response
    // Note that, for UI inserted records - second part of datetime may be non-zero (though not shown in UI)
    // Hence, we skip seconds from API response
    //

    const records = (await api.dbTableRow.list('sakila', context.base.id, 'MyTable', { limit: 10 })) as {
      list: Record<string, any>[];
      pageInfo: PaginatedType;
    };
    records.list = records.list.filter(record => record.DatetimeWithoutTz && record.DatetimeWithTz);
    let dateTimeWithoutTz = records.list.map(record => record.DatetimeWithoutTz);
    let dateTimeWithTz = records.list.map(record => record.DatetimeWithTz);

    const expectedDateTimeWithoutTz = [
      '2023-04-27 02:00:00+00:00',
      '2023-04-27 04:30:00+00:00',
      getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
    ];
    const expectedDateTimeWithTz = [
      '2023-04-27 02:00:00+00:00',
      '2023-04-27 04:30:00+00:00',
      getDateTimeInUTCTimeZone(`2023-04-27 10:00:00${formattedOffset}`),
    ];

    // reset seconds to 00 using string functions in dateTimeWithoutTz
    dateTimeWithoutTz = dateTimeWithoutTz.map(
      dateTimeString => dateTimeString.substring(0, 17) + '00' + dateTimeString.substring(19)
    );
    dateTimeWithTz = dateTimeWithTz.map(
      dateTimeString => dateTimeString.substring(0, 17) + '00' + dateTimeString.substring(19)
    );

    expect(dateTimeWithoutTz).toEqual(expectedDateTimeWithoutTz);
    expect(dateTimeWithTz).toEqual(expectedDateTimeWithTz);
  });
});
