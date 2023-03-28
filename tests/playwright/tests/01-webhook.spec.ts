import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import makeServer from '../setup/server';
import { WebhookFormPage } from '../pages/Dashboard/WebhookForm';
import { isSubset } from './utils/general';
import { Api, UITypes } from 'nocodb-sdk';

const hookPath = 'http://localhost:9090/hook';
let api: Api<any>;

// clear server data
async function clearServerData({ request }) {
  // clear stored data in server
  await request.get(hookPath + '/clear');

  // ensure stored message count is 0
  const response = await request.get(hookPath + '/count');
  await expect(await response.json()).toBe(0);
}

async function getWebhookResponses({ request, count = 1 }) {
  let response;

  // retry since there can be lag between the time the hook is triggered and the time the server receives the request
  for (let i = 0; i < 20; i++) {
    response = await request.get(hookPath + '/count');
    if ((await response.json()) === count) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await expect(await response.json()).toBe(count);

  response = await request.get(hookPath + '/all');
  return await response.json();
}

async function verifyHookTrigger(count: number, value: string, request, expectedData?: any) {
  // Retry since there can be lag between the time the hook is triggered and the time the server receives the request
  let response;

  // retry since there can be lag between the time the hook is triggered and the time the server receives the request
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

    // retry since there can be lag between the time the hook is triggered and the time the server receives the request
    for (let i = 0; i < 20; i++) {
      response = await request.get(hookPath + '/last');
      const rspJson = await response.json();
      if (rspJson.data.rows[0].Title === value) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    const rspJson = await response.json();
    await expect(rspJson?.data?.rows[0]?.Title).toBe(value);
    if (expectedData) {
      await expect(isSubset(rspJson, expectedData)).toBe(true);
    }
  }
}

async function buildExpectedResponseData(type, value, oldValue?) {
  const expectedData = {
    type: 'records.after.insert',
    data: {
      table_name: 'Test',
      view_name: 'Test',
      rows: [
        {
          Title: 'Poole',
        },
      ],
    },
  };

  expectedData.type = type;
  expectedData.data.rows[0].Title = value;

  if (oldValue) {
    expectedData.data['previous_rows'] = [];
    expectedData.data['previous_rows'][0] = {
      Title: oldValue,
    };
  }

  return expectedData;
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
    // Waiting for the server to start
    await page.waitForTimeout(1000);

    // close 'Team & Auth' tab
    await clearServerData({ request });
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.createTable({ title: 'Test' });

    // create
    //
    // hook order
    // hook-1: after insert
    //  - verify trigger after insert
    //  - verify no trigger after edit
    //  - verify no trigger after delete

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
    await verifyHookTrigger(1, 'Poole', request, buildExpectedResponseData('records.after.insert', 'Poole'));

    // trigger edit row & delete row
    // verify that the hook is not triggered (count doesn't change in this case)
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(1, 'Poole', request);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(1, 'Poole', request);

    ///////////////////////////////////////////////////////////////////////////

    // update
    //
    // hook order
    // hook-1: after insert
    // hook-2: after update
    //  - verify trigger after insert
    //  - verify trigger after edit
    //  - verify no trigger after delete

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
    await verifyHookTrigger(1, 'Poole', request, buildExpectedResponseData('records.after.insert', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(
      2,
      'Delaware',
      request,
      buildExpectedResponseData('records.after.update', 'Delaware', 'Poole')
    );
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(2, 'Delaware', request);

    ///////////////////////////////////////////////////////////////////////////

    // hook order
    // hook-1: after insert
    // hook-2: after update
    // hook-3: after delete
    //  - verify trigger after insert
    //  - verify trigger after edit
    //  - verify trigger after delete

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
    await verifyHookTrigger(1, 'Poole', request, buildExpectedResponseData('records.after.insert', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(
      2,
      'Delaware',
      request,
      buildExpectedResponseData('records.after.update', 'Delaware', 'Poole')
    );
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Delaware', request, buildExpectedResponseData('records.after.delete', 'Delaware'));

    ///////////////////////////////////////////////////////////////////////////

    // modify webhook

    // hook order
    // hook-1: after delete
    // hook-2: after delete
    // hook-3: after delete
    //  - verify no trigger after insert
    //  - verify no trigger after edit
    //  - verify trigger after delete

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

    // for insert & edit, the hook should not be triggered (count doesn't change in this case)
    await verifyHookTrigger(0, 'Poole', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(0, 'Delaware', request);
    await dashboard.grid.deleteRow(0);

    // for delete, the hook should be triggered (thrice in this case)
    await verifyHookTrigger(3, 'Delaware', request, buildExpectedResponseData('records.after.delete', 'Delaware'));

    ///////////////////////////////////////////////////////////////////////////

    // delete webhook

    // hook order
    // hook-1: -
    // hook-2: -
    // hook-3: -
    //  - verify no trigger after insert
    //  - verify no trigger after edit
    //  - verify no trigger after delete

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

    ///////////////////////////////////////////////////////////////////////////

    // webhook with condition

    // hook order
    // hook-1: after insert where Title is like 'Poole'
    // hook-2: after update where Title is like 'Poole'
    // hook-3: after delete where Title is like 'Poole'
    //  - verify trigger after insert gets triggered only when Title is like 'Poole'
    //  - verify trigger after edit gets triggered only when Title is like 'Poole'
    //  - verify trigger after delete gets triggered only when Title is like 'Poole'

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
    await verifyHookTrigger(1, 'Poole', request, buildExpectedResponseData('records.after.insert', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(
      2,
      'Poole',
      request,
      buildExpectedResponseData('records.after.update', 'Poole', 'Delaware')
    );
    await dashboard.grid.deleteRow(1);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Poole', request, buildExpectedResponseData('records.after.delete', 'Poole'));

    ///////////////////////////////////////////////////////////////////////////

    // webhook after conditions are removed

    // hook order
    // hook-1: after insert
    // hook-2: after update
    // hook-3: after delete
    //  - verify trigger after insert gets triggered when Title is like 'Poole' or not
    //  - verify trigger after edit gets triggered when Title is like 'Poole' or not
    //  - verify trigger after delete gets triggered when Title is like 'Poole' or not
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
    await verifyHookTrigger(2, 'Delaware', request, buildExpectedResponseData('records.after.insert', 'Delaware'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(
      4,
      'Poole',
      request,
      buildExpectedResponseData('records.after.update', 'Poole', 'Delaware')
    );
    await dashboard.grid.deleteRow(1);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(6, 'Delaware', request, buildExpectedResponseData('records.after.delete', 'Delaware'));
  });

  test('Bulk operations', async ({ request, page }) => {
    async function verifyBulkOperationTrigger(rsp, type, valueCounter, oldValueCounter?) {
      for (let i = 0; i < rsp.length; i++) {
        expect(rsp[i].type === type);
        expect(rsp[i].data.table_name === 'numberBased');
        expect(rsp[i].data.view_name === 'numberBased');
        expect(rsp[i].data.rows.length === 25);
        for (let j = 0; j < rsp[i].data.rows.length; j++) {
          expect(rsp[i].data.rows[j].Number === (i * 25 + j + 1) * valueCounter);
        }

        if (oldValueCounter) {
          expect(rsp[i].data.previous_rows.length === 25);
          for (let j = 0; j < rsp[i].data.previous_rows.length; j++) {
            expect(rsp[i].data.previous_rows[j].Number === (i * 25 + j + 1) * oldValueCounter);
          }
        }
      }
    }

    // Waiting for the server to start
    await page.waitForTimeout(1000);

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Number',
        title: 'Number',
        uidt: UITypes.Number,
      },
    ];
    let project, table;

    try {
      project = await api.project.read(context.project.id);
      table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'numberBased',
        title: 'numberBased',
        columns: columns,
      });
    } catch (e) {
      console.error(e);
    }

    await page.reload();
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // create after insert webhook
    await webhook.create({
      title: 'hook-1',
      event: 'After Insert',
    });
    await webhook.create({
      title: 'hook-1',
      event: 'After Update',
    });
    await webhook.create({
      title: 'hook-1',
      event: 'After Delete',
    });

    await clearServerData({ request });
    const rowAttributesForInsert = Array.from({ length: 50 }, (_, i) => ({
      Id: i + 1,
      Number: (i + 1) * 100,
    }));
    await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributesForInsert);
    await page.reload();
    // 50 records inserted, we expect 2 webhook responses
    let rsp = await getWebhookResponses({ request, count: 2 });
    await verifyBulkOperationTrigger(rsp, 'records.after.insert', 100);

    // bulk update all rows
    await clearServerData({ request });
    // build rowAttributes for update to contain all the ids & their value set to 100
    const rowAttributesForUpdate = Array.from({ length: 50 }, (_, i) => ({
      Id: i + 1,
      Number: (i + 1) * 111,
    }));

    await api.dbTableRow.bulkUpdate('noco', context.project.id, table.id, rowAttributesForUpdate);
    await page.reload();
    // 50 records updated, we expect 2 webhook responses
    rsp = await getWebhookResponses({ request, count: 2 });
    await verifyBulkOperationTrigger(rsp, 'records.after.update', 111, 100);

    // bulk delete all rows
    await clearServerData({ request });
    const rowAttributesForDelete = Array.from({ length: 50 }, (_, i) => ({ Id: i + 1 }));

    await api.dbTableRow.bulkDelete('noco', context.project.id, table.id, rowAttributesForDelete);
    await page.reload();
    rsp = await getWebhookResponses({ request, count: 2 });
    await verifyBulkOperationTrigger(rsp, 'records.after.delete', 111);
  });

  test('Virtual columns', async ({ request, page }) => {
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

      const cityRowAttributes = [
        { City: 'Mumbai', CityCode: 23 },
        { City: 'Pune', CityCode: 33 },
        { City: 'Delhi', CityCode: 43 },
        { City: 'Bangalore', CityCode: 53 },
      ];
      await api.dbTableRow.bulkCreate('noco', context.project.id, cityTable.id, cityRowAttributes);

      const countryRowAttributes = [
        { Country: 'India', CountryCode: 1 },
        { Country: 'USA', CountryCode: 2 },
        { Country: 'UK', CountryCode: 3 },
        { Country: 'Australia', CountryCode: 4 },
      ];
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

      // Create links
      await api.dbTableRow.nestedAdd('noco', context.project.title, countryTable.title, 1, 'hm', 'CityList', '1');
      await api.dbTableRow.nestedAdd('noco', context.project.title, countryTable.title, 1, 'hm', 'CityList', '2');
      await api.dbTableRow.nestedAdd('noco', context.project.title, countryTable.title, 2, 'hm', 'CityList', '3');
      await api.dbTableRow.nestedAdd('noco', context.project.title, countryTable.title, 3, 'hm', 'CityList', '4');

      // create formula column
      countryTable = await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityCodeFormula',
        title: 'CityCodeFormula',
        uidt: UITypes.Formula,
        formula_raw: '({Id} * 100)',
      });
    } catch (e) {
      console.log(e);
    }

    await page.reload();
    await dashboard.treeView.openTable({ title: 'Country' });

    // create after update webhook
    // after update hook
    await webhook.create({
      title: 'hook-2',
      event: 'After Update',
    });

    // clear server data
    await clearServerData({ request });

    // edit first record
    await dashboard.grid.editRow({ index: 0, columnHeader: 'Country', value: 'INDIA', networkValidation: false });
    const rsp = await getWebhookResponses({ request, count: 1 });
    console.log(rsp);

    const expectedData = {
      type: 'records.after.update',
      data: {
        table_name: 'Country',
        view_name: 'Country',
        previous_rows: [
          {
            Id: 1,
            Country: 'India',
            CountryCode: 1,
            CityCodeRollup: 2,
            CityCodeFormula: 100,
            CityList: [
              {
                Id: 1,
                City: 'Mumbai',
              },
              {
                Id: 2,
                City: 'Pune',
              },
            ],
            CityCodeLookup: [23, 33],
          },
        ],
        rows: [
          {
            Id: 1,
            Country: 'INDIA',
            CountryCode: 1,
            CityCodeRollup: 2,
            CityCodeFormula: 100,
            CityList: [
              {
                Id: 1,
                City: 'Mumbai',
              },
              {
                Id: 2,
                City: 'Pune',
              },
            ],
            CityCodeLookup: [23, 33],
          },
        ],
      },
    };

    await expect(isSubset(rsp[0], expectedData)).toBe(true);
  });
});
