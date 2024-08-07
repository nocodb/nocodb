import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { AggregaionBarPage } from '../../../pages/Dashboard/Grid/AggregationBar';
import { Api, ProjectListType, UITypes } from 'nocodb-sdk';
import { isEE } from '../../../setup/db';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { getDefaultPwd } from '../../utils/general';

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

const verificationNumericalData = {
  Number: {
    sum: '142',
    min: '42',
    max: '100',
    avg: '71',
    median: '71',
    std_dev: '29',
    range: '58',
  },
  Decimal: {
    sum: '5.9',
    min: '2.7',
    max: '3.1',
    avg: '2.9',
    median: '2.9',
    std_dev: '0.2',
    range: '0.4',
  },
  Duration: {
    sum: '00:55',
    min: '00:22',
    max: '00:33',
    avg: '00:28',
    median: '00:28',
    std_dev: '00:06',
    range: '00:12',
  },
};

const verificationStringData = {
  Title: {
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
  JSON: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
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

const verificationDateTime = {
  DateTime: {
    earliest_date: '2024-01-01 10:00',
    latest_date: '2024-02-02 12:00',
    date_range: '32 days',
    month_range: '1 month',
  },
  Date: {
    earliest_date: '2024-01-01',
    latest_date: '2024-02-02',
    date_range: '32 days',
    month_range: '1 month',
  },
};

const verificationNUmericalDataAfterFilter = {
  Number: {
    sum: '42',
    min: '42',
    max: '42',
    avg: '42',
    median: '42',
    std_dev: '0',
    range: '0',
  },
  Decimal: {
    sum: '3.1',
    min: '3.1',
    max: '3.1',
    avg: '3.1',
    median: '3.1',
    std_dev: '0',
    range: '0',
  },
  Duration: {
    sum: '00:22',
    min: '00:22',
    max: '00:22',
    avg: '00:22',
    median: '00:22',
    std_dev: '00:00',
    range: '00:00',
  },
};

const verificationStringDataAfterFilter = {
  Title: {
    count_unique: '2',
    count_empty: '0',
    count_filled: '2',
    percent_unique: '100',
    percent_filled: '100',
    percent_empty: '0',
  },
  SingleSelect: {
    count_unique: '1',
    count_empty: '1',
    count_filled: '1',
    percent_unique: '50',
    percent_filled: '50',
    percent_empty: '50',
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

const verificationDateTimeDataAfterFilter = {
  Date: {
    earliest_date: '2024-01-01',
    latest_date: '2024-01-01',
    date_range: '0 days',
    month_range: '0 month',
  },
  DateTime: {
    earliest_date: '2024-01-01 10:00',
    latest_date: '2024-01-01 10:00',
    date_range: '0 days',
    month_range: '0 month',
  },
};

const users: string[] = isEE()
  ? ['useree@nocodb.com', 'useree-0@nocodb.com', 'useree-1@nocodb.com', 'useree-2@nocodb.com', 'useree-3@nocodb.com']
  : ['user@nocodb.com', 'user-0@nocodb.com', 'user-1@nocodb.com', 'user-2@nocodb.com', 'user-3@nocodb.com'];

const roleDb = [
  { email: 'useree@nocodb.com', role: 'editor' },
  { email: 'useree-0@nocodb.com', role: 'editor' },
  { email: 'useree-1@nocodb.com', role: 'editor' },
  { email: 'useree-2@nocodb.com', role: 'editor' },
  { email: 'useree-3@nocodb.com', role: 'editor' },
];

test.describe('Field Aggregation', () => {
  let dashboard: DashboardPage, aggregationBar: AggregaionBarPage;
  let context: any;
  let sharedLink: string;
  let testContext: any;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    const { api, table, base } = await columnAggregationSuite(`xcdb${context.workerId}`, context);

    testContext = { api, table, base };

    aggregationBar = dashboard.grid.aggregationBar;

    await page.reload();

    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.openTable({ title: 'Test Table' });

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, data);

    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('String Columns', async ({ page }) => {
    const { api, table, base } = testContext;

    if (isEE()) {
      workspacePage = new WorkspacePage(page);
      collaborationPage = workspacePage.collaboration;

      for (let i = 0; i < roleDb.length; i++) {
        try {
          await api.auth.signup({
            email: roleDb[i].email,
            password: getDefaultPwd(),
          });
        } catch (e) {
          // ignore error even if user already exists
        }
      }

      await dashboard.leftSidebar.clickTeamAndSettings();

      for (const user of roleDb) {
        await collaborationPage.addUsers(user.email, user.role);
      }
    }

    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.openTable({ title: 'Test Table' });

    await dashboard.grid.cell.userOption.select({
      index: 0,
      columnHeader: 'User',
      option: users[0],
      multiSelect: false,
    });

    await page.reload({ waitUntil: 'networkidle' });

    for (const x of Object.entries(verificationStringData)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, [
      {
        Id: 3,
        Title: 'Sample2',
      },
    ]);

    await dashboard.grid.toolbar.clickFilter();

    await dashboard.grid.toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'Sample',
    });

    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: 'networkidle' });

    for (const x of Object.entries(verificationStringDataAfterFilter)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }
  });

  test('Numerical Columns', async ({ page }) => {
    for (const x of Object.entries(verificationNumericalData)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }

    const { api, table, base } = testContext;

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, [
      {
        Id: 3,
        Title: 'Sample2',
      },
    ]);

    await dashboard.grid.toolbar.clickFilter();

    await dashboard.grid.toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'Sample',
    });

    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: 'networkidle' });

    for (const x of Object.entries(verificationNUmericalDataAfterFilter)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }
  });

  test('DateTime Columns', async ({ page }) => {
    for (const x of Object.entries(verificationDateTime)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }

    const { api, table, base } = testContext;

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, [
      {
        Id: 3,
        Title: 'Sample2',
      },
    ]);

    await dashboard.grid.toolbar.clickFilter();

    await dashboard.grid.toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'Sample',
    });

    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: 'networkidle' });

    for (const x of Object.entries(verificationDateTimeDataAfterFilter)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }
  });

  test('Shared GridView', async ({ page }) => {
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    sharedLink = await dashboard.grid.topbar.getSharedViewUrl();
    await page.goto(sharedLink);

    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await page.reload();
    const sharedPage = new DashboardPage(page, context.base);

    for (const x of Object.entries(verificationNumericalData)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await sharedPage.grid.aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await sharedPage.grid.aggregationBar.verifyAggregation({
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

test.describe('Column Aggregations - Links', () => {
  let dashboard: DashboardPage, aggregationBar: AggregaionBarPage;
  let context: any;
  let sharedLink: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    aggregationBar = dashboard.grid.aggregationBar;

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });

    // subsequent table creation fails; hence delay
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Sheet2', baseTitle: context.base.title });

    await dashboard.treeView.openTable({ title: 'Sheet1' });

    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });

    await dashboard.grid.column.create({
      title: 'Link1-2hm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Has Many',
    });

    await dashboard.grid.column.create({
      title: 'Link1-2mm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Many to Many',
    });

    await dashboard.treeView.openTable({ title: 'Sheet2' });

    await dashboard.grid.column.create({
      title: 'Link2-1hm',
      type: 'Links',
      childTable: 'Sheet1',
      relationType: 'Has Many',
    });

    await page.reload();
  });

  const verifySheet2 = {
    Title: {
      count_unique: '3',
      count_empty: '0',
      count_filled: '3',
      percent_unique: '100%',
      percent_filled: '100%',
      percent_empty: '0%',
    },
    Sheet1: {
      count_unique: '3',
      count_empty: '0',
      count_filled: '3',
      percent_unique: '100%',
      percent_filled: '100%',
      percent_empty: '0%',
    },
    Sheet1s: {
      count_unique: '1',
      count_empty: '0',
      count_filled: '3',
      percent_unique: '33.3%',
      percent_filled: '100%',
      percent_empty: '0%',
      sum: '3',
      min: '1',
      max: '1',
      avg: '1',
      median: '1',
      std_dev: '0',
      range: '0',
    },
    'Link2-1hm': {
      count_unique: '1',
      count_empty: '0',
      count_filled: '3',
      percent_unique: '33.3%',
      percent_filled: '100%',
      percent_empty: '0%',
      sum: '3',
      min: '1',
      max: '1',
      avg: '1',
      median: '1',
      std_dev: '0',
      range: '0',
    },
  };

  test('Grid Links ', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Sheet2' });

    await dashboard.grid.footbar.clickAddRecordFromForm();
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: '2a',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1',
      value: '1a',
      type: 'belongsTo',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1s',
      value: '1a',
      type: 'manyToMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link2-1hm',
      value: '1a',
      type: 'hasMany',
    });
    await dashboard.expandedForm.save();

    await dashboard.grid.addNewRow({ index: 1, value: '2b' });
    await dashboard.grid.cell.inCellAdd({ index: 1, columnHeader: 'Sheet1' });
    await dashboard.linkRecord.select('1b', false);
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Sheet1s',
    });
    await dashboard.linkRecord.select('1b');
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Link2-1hm',
    });
    await dashboard.linkRecord.select('1b');

    // Expand record insert
    await dashboard.grid.addNewRow({ index: 2, value: '2c-temp' });
    await dashboard.grid.openExpandedRow({ index: 2 });

    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1',
      value: '1c',
      type: 'belongsTo',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1s',
      value: '1c',
      type: 'manyToMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link2-1hm',
      value: '1c',
      type: 'hasMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: '2c',
      type: 'text',
    });

    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.expandedForm.save();

    for (const x of Object.entries(verifySheet2)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }

    sharedLink = await dashboard.grid.topbar.getSharedViewUrl();
    await page.goto(sharedLink);

    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await page.reload();
    const sharedPage = new DashboardPage(page, context.base);

    for (const x of Object.entries(verifySheet2)) {
      const colName = x[0];

      for (const y of Object.entries(x[1])) {
        await sharedPage.grid.aggregationBar.updateAggregation({
          column_name: colName,
          aggregation: y[0],
          skipNetworkValidation: true,
        });

        await sharedPage.grid.aggregationBar.verifyAggregation({
          column_name: colName,
          aggregation: y[1],
        });
      }
    }
  });
});
