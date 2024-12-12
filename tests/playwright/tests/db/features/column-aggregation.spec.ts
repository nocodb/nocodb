import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { AggregaionBarPage } from '../../../pages/Dashboard/Grid/AggregationBar';
import { Api, ProjectListType, UITypes } from 'nocodb-sdk';
import { isEE } from '../../../setup/db';

const columns = [
  {
    column_name: 'Id',
    title: 'Id',
    uidt: UITypes.ID,
    ai: 1,
    pk: 1,
  },
  {
    column_name: 'SingleLineText',
    title: 'Title',
    uidt: UITypes.SingleLineText,
  },
  {
    column_name: 'Attachment',
    title: 'Attachment',
    uidt: UITypes.Attachment,
  },
  {
    column_name: 'User',
    title: 'User',
    uidt: UITypes.User,
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
    column_name: 'Decimal',
    title: 'Decimal',
    uidt: UITypes.Decimal,
  },
  {
    column_name: 'Checkbox',
    title: 'Checkbox',
    uidt: UITypes.Checkbox,
  },
  {
    column_name: 'MultiSelect',
    title: 'MultiSelect',
    uidt: UITypes.MultiSelect,
    dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
  },
  {
    column_name: 'SingleSelect',
    title: 'SingleSelect',
    uidt: UITypes.SingleSelect,
    dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
  },
  {
    column_name: 'Date',
    title: 'Date',
    uidt: UITypes.Date,
  },
  {
    column_name: 'DateTime',
    title: 'DateTime',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'Year',
    title: 'Year',
    uidt: UITypes.Year,
  },
  {
    column_name: 'Time',
    title: 'Time',
    uidt: UITypes.Time,
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
    column_name: 'Url',
    title: 'Url',
    uidt: UITypes.URL,
  },
  {
    column_name: 'Currency',
    title: 'Currency',
    uidt: UITypes.Currency,
  },
  {
    column_name: 'Percent',
    title: 'Percent',
    uidt: UITypes.Percent,
  },
  {
    column_name: 'Duration',
    title: 'Duration',
    uidt: UITypes.Duration,
  },
  {
    column_name: 'Rating',
    title: 'Rating',
    uidt: UITypes.Rating,
  },
  {
    column_name: 'Geometry',
    title: 'Geometry',
    uidt: UITypes.Geometry,
  },
  {
    column_name: 'JSON',
    title: 'JSON',
    uidt: UITypes.JSON,
  },
];

const data = [
  {
    Id: 1,
    Title: 'Sample Title',
    LongText: 'This is a sample long text',
    Number: 42,
    Decimal: 3.14,
    Checkbox: true,
    MultiSelect: 'jan',
    SingleSelect: 'jan',
    Date: '2024-01-01',
    DateTime: '2024-01-01T10:00:00Z',
    Year: 2024,
    Time: '10:00:00',
    PhoneNumber: '+1234567890',
    Email: 'example@example.com',
    Url: 'https://example.com',
    Currency: 100.0,
    Percent: 50,
    Duration: 1309,
    Rating: 4,
    JSON: '{"key": "value"}',
  },
  {
    Id: 2,
    Title: 'Another Title',
    LongText: 'This is another long text',
    Number: 100,
    Decimal: 2.718,
    Checkbox: false,
    MultiSelect: 'mar',
    SingleSelect: 'feb',
    Date: '2024-02-02',
    DateTime: '2024-02-02T12:00:00Z',
    Year: 2025,
    Time: '12:00:00',
    PhoneNumber: '+0987654321',
    Email: 'another@example.com',
    Url: 'https://anotherexample.com',
    Currency: 200.5,
    Percent: 75,
    Duration: 2000,
    Rating: 5,
    JSON: '{"another_key": "another_value"}',
  },
];

const verificationData = {
  Title: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  LongText: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Number: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    sum: '142',
    min: '42',
    max: '100',
    avg: '71',
    median: '71',
    std_dev: '29',
    range: '58',
  },
  Decimal: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    sum: '5.9',
    min: '2.7',
    max: '3.1',
    avg: '2.9',
    median: '2.9',
    std_dev: '0.2',
    range: '0.4',
  },
  Checkbox: {
    checked: '1',
    unchecked: '1',
    percent_checked: '50',
    percent_unchecked: '50',
  },
  MultiSelect: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  SingleSelect: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Date: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    earliest_date: '2024-01-01',
    latest_date: '2024-02-02',
    date_range: '32 days',
    month_range: '1 month',
  },
  DateTime: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    earliest_date: '2024-01-01 10:00',
    latest_date: '2024-02-02 12:00',
    date_range: '32 days',
    month_range: '1 month',
  },
  Year: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Time: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  PhoneNumber: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Email: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Url: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Currency: {
    sum: '300.5',
    min: '100',
    max: '200.5',
    avg: '150.25',
    median: '150.25',
    std_dev: '0.2',
    range: '100.5',
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Percent: {
    sum: '125',
    min: '50',
    max: '75',
    avg: '62.5%',
    median: '62.5%',
    std_dev: '12.5%',
    range: '25%',
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Duration: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    sum: '00:55',
    min: '00:22',
    max: '00:33',
    avg: '00:28',
    median: '00:28',
    std_dev: '00:06',
    range: '00:12',
  },

  Rating: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
    sum: '9',
    min: '4',
    max: '5',
    avg: '4.5',
    median: '4.5',
    std_dev: '0.5',
    range: '1',
  },

  JSON: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  Attachment: {
    attachment_size: '1.81 MiB',
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50%',
    percent_filled: '50%',
    percent_empty: '50%',
  },
  User: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50%',
    percent_filled: '50%',
    percent_empty: '50%',
  },
};

const verificationDataAfterFilter = {
  Title: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  LongText: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Number: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    sum: '42',
    min: '42',
    max: '42',
    avg: '42',
    median: '42',
    std_dev: '0',
    range: '0',
  },
  Decimal: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    sum: '3.1',
    min: '3.1',
    max: '3.1',
    avg: '3.1',
    median: '3.1',
    std_dev: '0',
    range: '0',
  },
  Checkbox: {
    checked: '1',
    unchecked: '1',
    percent_checked: '50',
    percent_unchecked: '50',
  },
  MultiSelect: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  SingleSelect: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Date: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    earliest_date: '2024-01-01',
    latest_date: '2024-01-01',
    date_range: '0 days',
    month_range: '0 month',
  },
  DateTime: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    earliest_date: '2024-01-01 10:00',
    latest_date: '2024-01-01 10:00',
    date_range: '0 days',
    month_range: '0 month',
  },
  Year: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Time: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  PhoneNumber: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Email: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Url: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Currency: {
    sum: '100',
    min: '100',
    max: '100',
    avg: '100',
    median: '100',
    std_dev: '0',
    range: '0',
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Percent: {
    sum: '50',
    min: '50',
    max: '50',
    avg: '50%',
    median: '50%',
    std_dev: '0%',
    range: '0%',
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  Duration: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    sum: '00:22',
    min: '00:22',
    max: '00:22',
    avg: '00:22',
    median: '00:22',
    std_dev: '00:00',
    range: '00:00',
  },

  Rating: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
    sum: '4',
    min: '4',
    max: '4',
    avg: '4',
    median: '2',
    std_dev: '0',
    range: '4',
  },
  JSON: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
  },
  User: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50%',
    percent_filled: '50%',
    percent_empty: '50%',
  },
};

test.describe('Field Aggregation', () => {
  let dashboard: DashboardPage, aggregationBar: AggregaionBarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    const { api, table, base } = await columnAggregationSuite(`xcdb${context.workerId}`, context);

    page.testContext = { api, table, base };

    aggregationBar = dashboard.grid.aggregationBar;

    await page.reload();

    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.openTable({ title: 'Test Table' });

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, data);

    await page.reload();

    const bigFile = [`${process.cwd()}/fixtures/sampleFiles/Image/6_bigSize.png`];
    await dashboard.grid.cell.attachment.addFile({
      index: 0,
      columnHeader: 'Attachment',
      filePath: bigFile,
    });

    await dashboard.grid.cell.userOption.select({
      index: 0,
      columnHeader: 'User',
      option: 'user-0@nocodb.com',
      multiSelect: false,
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Aggregation Grid Test', async ({ page }) => {
    // Write your test here

    for (const x of Object.entries(verificationData)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }

    const { api, table, base } = page.testContext;

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, [
      {
        Id: 3,
        Title: 'Sample2',
      },
    ]);

    await page.reload();

    await dashboard.grid.toolbar.clickFilter();

    await dashboard.grid.toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'Sample',
    });

    await page.waitForTimeout(4000);

    await dashboard.grid.toolbar.clickFilter();

    for (const x of Object.entries(verificationDataAfterFilter)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }
  });

  async function columnAggregationSuite(baseTitle: string, context: NcContext, skipTableCreate?: boolean) {
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
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
      table_name: 'Test Table',
      title: 'Test Table',
      columns: columns,
    });
    return { base, table, api };
  }
});
