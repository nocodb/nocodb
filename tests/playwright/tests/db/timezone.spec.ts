import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';
import { knex } from 'knex';
import { Api, UITypes } from 'nocodb-sdk';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { isMysql, isPg, isSqlite } from '../../setup/db';
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

async function timezoneSuite(token?: string, skipTableCreate?: boolean) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': token,
    },
  });

  const projectList = await api.project.list();
  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }

  const project = await api.project.create({ title: 'xcdb' });
  if (skipTableCreate) return { project };
  const table = await api.base.tableCreate(project.id, project.bases?.[0].id, {
    table_name: 'dateTimeTable',
    title: 'dateTimeTable',
    columns: columns,
  });

  return { project, table };
}

test.describe('Timezone : Japan/Tokyo', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    if (!isSqlite(context)) return;

    try {
      const { project, table } = await timezoneSuite(context.token);

      await api.dbTableRow.bulkCreate('noco', project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', project.id, table.id, { limit: 10 });
    } catch (e) {
      console.error(e);
    }

    await page.reload();
  });

  // DST independent test
  test.use({
    locale: 'ja-JP', // Change to Japanese locale
    timezoneId: 'Asia/Tokyo', // Set timezone to Tokyo timezone
  });

  /*
   * This test is to verify the display value of DateTime column in the grid
   * when the timezone is set to Asia/Tokyo
   *
   * The test inserts 3 rows using API
   * 1. DateTime inserted without timezone
   * 2. DateTime inserted with timezone (UTC+4)
   * 3. DateTime inserted with timezone (UTC-4)
   *
   * Expected display values:
   *  Display value is converted to Asia/Tokyo
   */
  test('API insert, verify display value', async () => {
    if (!isSqlite(context)) return;

    await dashboard.clickHome();
    const projectsPage = new ProjectsPage(dashboard.rootPage);
    await projectsPage.openProject({ title: 'xcdb', withoutPrefix: true });

    await dashboard.treeView.openTable({ title: 'dateTimeTable' });

    // DateTime inserted using API without timezone is converted to UTC
    // Display value is converted to Asia/Tokyo
    await dashboard.grid.cell.verifyDateCell({ index: 0, columnHeader: 'DateTime', value: '2021-01-01 09:00' });

    // DateTime inserted using API with timezone is converted to UTC
    // Display value is converted to Asia/Tokyo
    await dashboard.grid.cell.verifyDateCell({ index: 1, columnHeader: 'DateTime', value: '2021-01-01 09:00' });
    await dashboard.grid.cell.verifyDateCell({ index: 2, columnHeader: 'DateTime', value: '2021-01-01 09:00' });
  });

  /*
   * This test is to verify the API read response of DateTime column
   * when the timezone is set to Asia/Tokyo
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
    if (!isSqlite(context)) return;

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

    try {
      const { project, table } = await timezoneSuite(context.token);
      await api.dbTableRow.bulkCreate('noco', project.id, table.id, rowAttributes);
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
    await dashboard.clickHome();
    const projectsPage = new ProjectsPage(dashboard.rootPage);
    await projectsPage.openProject({ title: 'xcdb', withoutPrefix: true });

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
    if (!isSqlite(context)) return;

    const { project } = await timezoneSuite(context.token, true);
    context.project = project;

    // Using API for test preparation was not working
    // Hence switched over to UI based table creation

    await dashboard.clickHome();
    const projectsPage = new ProjectsPage(dashboard.rootPage);
    await projectsPage.openProject({ title: 'xcdb', withoutPrefix: true });

    await dashboard.treeView.createTable({ title: 'dateTimeTable', mode: 'Xcdb' });
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
    if (!isSqlite(context)) return;

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
    if (!isSqlite(context)) return;

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
    if (!isSqlite(context)) return;

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

async function createTableWithDateTimeColumn(database: string) {
  if (database === 'pg') {
    const config = {
      client: 'pg',
      connection: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'postgres',
        multipleStatements: true,
      },
      searchPath: ['public', 'information_schema'],
      pool: { min: 0, max: 5 },
    };

    const config2 = {
      ...config,
      connection: {
        ...config.connection,
        database: 'datetimetable',
      },
    };
    const pgknex = knex(config);
    await pgknex.raw(`DROP DATABASE IF EXISTS datetimetable`);
    await pgknex.raw(`CREATE DATABASE datetimetable`);
    await pgknex.destroy();

    const pgknex2 = knex(config2);
    await pgknex2.raw(`
    CREATE TABLE my_table (
      title SERIAL PRIMARY KEY,
      datetime_without_tz TIMESTAMP WITHOUT TIME ZONE,
      datetime_with_tz TIMESTAMP WITH TIME ZONE
    );
    SET timezone = 'Asia/Hong_Kong';
    SELECT pg_sleep(1);
    INSERT INTO my_table (datetime_without_tz, datetime_with_tz)
    VALUES
      ('2023-04-27 10:00:00', '2023-04-27 12:30:00'),
      ('2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30');
  `);
    await pgknex2.destroy();
  } else if (database === 'mysql') {
    const config = {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'sakila',
      },
      pool: { min: 0, max: 5 },
    };

    const config2 = {
      ...config,
      connection: {
        ...config.connection,
        database: 'datetimetable',
      },
    };

    const mysqlknex = knex(config);
    await mysqlknex.raw(`DROP DATABASE IF EXISTS datetimetable`);
    await mysqlknex.raw(`CREATE DATABASE datetimetable`);
    await mysqlknex.destroy();

    const mysqlknex2 = knex(config2);
    await mysqlknex2.raw(`
    CREATE TABLE my_table (
      title INT AUTO_INCREMENT PRIMARY KEY,
      datetime_without_tz DATETIME,
      datetime_with_tz TIMESTAMP
    );
    INSERT INTO my_table (datetime_without_tz, datetime_with_tz)
    VALUES
      ('2023-04-27 10:00:00', '2023-04-27 12:30:00'),
      ('2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30');
    `);
    await mysqlknex2.destroy();
  } else if (database === 'sqlite') {
    const config = {
      client: 'sqlite3',
      connection: {
        filename: './mydb.sqlite3',
      },
      useNullAsDefault: true,
      pool: { min: 0, max: 5 },
    };

    // SQLite supports just one type of datetime
    // Timezone information, if specified is stored as is in the database
    // https://www.sqlite.org/lang_datefunc.html

    const sqliteknex = knex(config);
    await sqliteknex.raw(`DROP TABLE IF EXISTS my_table`);
    await sqliteknex.raw(`
    CREATE TABLE my_table (
      title INTEGER PRIMARY KEY AUTOINCREMENT,
      datetime_without_tz DATETIME,
      datetime_with_tz DATETIME
    )
`);
    const datetimeData = [
      ['2023-04-27 10:00:00', '2023-04-27 10:00:00'],
      ['2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30'],
    ];
    for (const data of datetimeData) {
      await sqliteknex('my_table').insert({
        datetime_without_tz: data[0],
        datetime_with_tz: data[1],
      });
    }
    await sqliteknex.destroy();
  }
}

test.describe('External DB - DateTime column', async () => {
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

    await createTableWithDateTimeColumn(context.dbType);

    if (isPg(context)) {
      await api.base.create(context.project.id, {
        alias: 'datetimetable',
        type: 'pg',
        config: {
          client: 'pg',
          connection: {
            host: 'localhost',
            port: '5432',
            user: 'postgres',
            password: 'password',
            database: 'datetimetable',
          },
          searchPath: ['public'],
        },
        inflection_column: 'camelize',
        inflection_table: 'camelize',
      });
    } else if (isMysql(context)) {
    } else if (isSqlite(context)) {
    }

    await dashboard.rootPage.reload();
  });

  test('Verify display value, UI insert, API response', async () => {
    await dashboard.treeView.openBase({ title: 'datetimetable' });
    await dashboard.treeView.openTable({ title: 'MyTable' });

    // display value for datetime column without tz should be same as stored value
    // display value for datetime column with tz should be converted to browser timezone (HK in this case)
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 0,
      columnHeader: 'DatetimeWithTz',
      value: '2023-04-27 12:30',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 1,
      columnHeader: 'DatetimeWithTz',
      value: '2023-04-27 12:30',
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
      dateTime: '2023-04-27 12:30:00',
    });

    // reload page & verify if inserted values are shown correctly
    await dashboard.rootPage.reload();
    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithoutTz',
      value: '2023-04-27 10:00',
    });
    await dashboard.grid.cell.verifyDateCell({
      index: 2,
      columnHeader: 'DatetimeWithTz',
      value: '2023-04-27 12:30',
    });

    // verify API response
    // Note that, for UI inserted records - second part of datetime may be non-zero (though not shown in UI)
    // Hence, we skip seconds from API response
    //
    const records = await api.dbTableRow.list('noco', context.project.id, 'MyTable', { limit: 10 });
    let dateTimeWithoutTz = records.list.map(record => record.DatetimeWithoutTz);
    let dateTimeWithTz = records.list.map(record => record.DatetimeWithTz);
    const expectedDateTimeWithoutTz = ['2023-04-27 10:00:00', '2023-04-27 10:00:00', '2023-04-27 10:00:00'];
    const expectedDateTimeWithTz = ['2023-04-27T04:30:00.000Z', '2023-04-27T04:30:00.000Z', '2023-04-27T04:30:00.000Z'];

    // reset seconds to 0
    dateTimeWithoutTz = dateTimeWithoutTz.map(dateTimeStr => {
      const [datePart, timePart] = dateTimeStr.split(' ');
      const updatedTimePart = timePart.split(':').slice(0, 2).join(':') + ':00';
      return `${datePart} ${updatedTimePart}`;
    });

    // reset seconds to 0
    dateTimeWithTz = dateTimeWithTz.map(dateTimeStr => {
      const dateObj = new Date(dateTimeStr);
      dateObj.setSeconds(0);
      return dateObj.toISOString();
    });

    expect(dateTimeWithoutTz).toEqual(expectedDateTimeWithoutTz);
    expect(dateTimeWithTz).toEqual(expectedDateTimeWithTz);
  });
});
