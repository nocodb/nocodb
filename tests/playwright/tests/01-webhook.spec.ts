import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import makeServer from '../setup/server';
import { WebhookFormPage } from '../pages/Dashboard/WebhookForm';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
let api: Api<any>;

const hookPath = 'http://localhost:9090/hook';

// clear server data
async function clearServerData({ request }) {
  // clear stored data in server
  await request.get(hookPath + '/clear');

  // ensure stored message count is 0
  const response = await request.get(hookPath + '/count');
  await expect(await response.json()).toBe(0);
}

async function verifyHookTrigger(count: number, value: string, request) {
  // Retry since there can be lag between the time the hook is triggered and the time the server receives the request
  let response;
  for (let i = 0; i < 20; i++) {
    response = await request.get(hookPath + '/count');
    if ((await response.json()) === count) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  await expect(await response.json()).toBe(count);

  if (count) {
    let response;
    for (let i = 0; i < 20; i++) {
      response = await request.get(hookPath + '/last');
      if ((await response.json()).Title === value) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    await expect((await response.json()).Title).toBe(value);
  }
}

test.describe.serial('Webhook', () => {
  // start a server locally for webhook tests

  let dashboard: DashboardPage, webhook: WebhookFormPage;
  let context: any;

  test.beforeAll(async () => {
    await makeServer();
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    webhook = dashboard.webhookForm;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test('CRUD', async ({ request, page }) => {
    // todo: Waiting for the server to start
    await page.waitForTimeout(1000);

    // close 'Team & Auth' tab
    await clearServerData({ request });
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.createTable({ title: 'Test' });

    // after insert hook
    await webhook.create({
      title: 'hook-1',
      event: 'After Insert',
    });
    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(1, 'Poole', request);

    // after update hook
    await webhook.create({
      title: 'hook-2',
      event: 'After Update',
    });

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(2, 'Delaware', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(2, 'Delaware', request);

    // after delete hook
    await webhook.create({
      title: 'hook-3',
      event: 'After Delete',
    });
    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(2, 'Delaware', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Delaware', request);

    // modify webhook
    await webhook.open({ index: 0 });
    await webhook.configureWebhook({
      title: 'hook-1-modified',
      event: 'After Delete',
    });
    await webhook.save();
    await webhook.close();
    await webhook.open({ index: 1 });
    await webhook.configureWebhook({
      title: 'hook-2-modified',
      event: 'After Delete',
    });
    await webhook.save();
    await webhook.close();

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(0, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(0, 'Delaware', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Delaware', request);

    // delete webhook
    await webhook.delete({ index: 0 });
    await webhook.delete({ index: 0 });
    await webhook.delete({ index: 0 });

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(0, '', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(0, '', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(0, '', request);
  });

  test('webhook Conditional webhooks', async ({ request }) => {
    test.slow();

    await clearServerData({ request });
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.createTable({ title: 'Test' });

    // after insert hook
    await webhook.create({
      title: 'hook-1',
      event: 'After Insert',
    });
    // after insert hook
    await webhook.create({
      title: 'hook-2',
      event: 'After Update',
    });
    // after insert hook
    await webhook.create({
      title: 'hook-3',
      event: 'After Delete',
    });

    await webhook.open({ index: 0 });
    await webhook.addCondition({
      column: 'Title',
      operator: 'is like',
      value: 'Poole',
      save: true,
    });

    await webhook.open({ index: 1 });
    await webhook.addCondition({
      column: 'Title',
      operator: 'is like',
      value: 'Poole',
      save: true,
    });

    await webhook.open({ index: 2 });
    await webhook.addCondition({
      column: 'Title',
      operator: 'is like',
      value: 'Poole',
      save: true,
    });

    // verify
    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await dashboard.grid.addNewRow({
      index: 1,
      columnHeader: 'Title',
      value: 'Delaware',
    });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(2, 'Poole', request);
    await dashboard.grid.deleteRow(1);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Poole', request);

    // Delete condition
    await webhook.open({ index: 2 });
    await webhook.deleteCondition({ save: true });
    await webhook.open({ index: 1 });
    await webhook.deleteCondition({ save: true });
    await webhook.open({ index: 0 });
    await webhook.deleteCondition({ save: true });

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await dashboard.grid.addNewRow({
      index: 1,
      columnHeader: 'Title',
      value: 'Delaware',
    });
    await verifyHookTrigger(2, 'Delaware', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(4, 'Poole', request);
    await dashboard.grid.deleteRow(1);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(6, 'Delaware', request);
  });

  test.only('Virtual columns', async ({ request, page }) => {
    let cityTable, countryTable;
    const cityColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'City',
        title: 'City',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
      {
        column_name: 'CityCode',
        title: 'CityCode',
        uidt: UITypes.Number,
      },
    ];
    const countryColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Country',
        title: 'Country',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
      {
        column_name: 'CountryCode',
        title: 'CountryCode',
        uidt: UITypes.Number,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      cityTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'Country',
        title: 'Country',
        columns: countryColumns,
      });

      const cities = ['Mumbai', 'Pune', 'Delhi', 'Bangalore'];
      const countries = ['India', 'USA', 'UK', 'Australia'];
      let cityRowAttributes = [];
      let countryRowAttributes = [];

      for (let i = 0; i < 50000; i++) {
        cityRowAttributes = [
          { City: cities[i % 4], CityCode: (i % 4) + 1 },
          { City: cities[(i + 1) % 4], CityCode: ((i + 1) % 4) + 1 },
          { City: cities[(i + 2) % 4], CityCode: ((i + 2) % 4) + 1 },
          { City: cities[(i + 3) % 4], CityCode: ((i + 3) % 4) + 1 },
        ];
      }

      for (let i = 0; i < 50000; i++) {
        countryRowAttributes = [
          { Country: countries[i % 4], CountryCode: (i % 4) + 1 },
          { Country: countries[(i + 1) % 4], CountryCode: ((i + 1) % 4) + 1 },
          { Country: countries[(i + 2) % 4], CountryCode: ((i + 2) % 4) + 1 },
          { Country: countries[(i + 3) % 4], CountryCode: ((i + 3) % 4) + 1 },
        ];
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, cityTable.id, cityRowAttributes);

      // const countryRowAttributes = [
      //   { Country: 'India', CountryCode: 1 },
      //   { Country: 'USA', CountryCode: 2 },
      //   { Country: 'UK', CountryCode: 3 },
      //   { Country: 'Australia', CountryCode: 4 },
      // ];
      await api.dbTableRow.bulkCreate('noco', context.project.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      countryTable = await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityList',
        title: 'CityList',
        uidt: UITypes.LinkToAnotherRecord,
        parentId: countryTable.id,
        childId: cityTable.id,
        type: 'hm',
      });

      // Create Lookup column in Country table
      countryTable = await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityCodeLookup',
        title: 'CityCodeLookup',
        uidt: UITypes.Lookup,
        fk_relation_column_id: countryTable.columns.filter(c => c.title === 'CityList')[0].id,
        fk_lookup_column_id: cityTable.columns.filter(c => c.title === 'CityCode')[0].id,
      });

      // Create Rollup column in Country table
      countryTable = await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityCodeRollup',
        title: 'CityCodeRollup',
        uidt: UITypes.Rollup,
        fk_relation_column_id: countryTable.columns.filter(c => c.title === 'CityList')[0].id,
        fk_rollup_column_id: cityTable.columns.filter(c => c.title === 'CityCode')[0].id,
        rollup_function: 'count',
      });

      // Create links 1-1
      for (let i = 0; i < 1000; i++) {
        await api.dbTableRow.nestedAdd(
          'noco',
          context.project.id,
          countryTable.id,
          i + 1,
          'hm',
          'CityList',
          `${i + 1}`
        );
      }

      for (let i = 0; i < 14; i++) {
        // create formula column
        countryTable = await api.dbTableColumn.create(countryTable.id, {
          column_name: `CityCodeFormula${i}`,
          title: `CityCodeFormula${i}`,
          uidt: UITypes.Formula,
          formula_raw: '({Id} * 100)',
        });
      }

      // read records
      const records = await api.dbTableRow.list('noco', context.project.id, countryTable.id, {
        limit: 1000,
      });
      console.log(records.list.length);
    } catch (e) {
      console.log(e);
    }

    await page.reload();
  });
});
