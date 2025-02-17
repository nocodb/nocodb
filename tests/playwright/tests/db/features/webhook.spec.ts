import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import makeServer from '../../../setup/server';
import { WebhookFormPage } from '../../../pages/Dashboard/WebhookForm';
import { isSubset } from '../../../tests/utils/general';
import { Api, UITypes } from 'nocodb-sdk';
import { enableQuickRun, isEE, isMysql, isSqlite } from '../../../setup/db';

const hookPath = 'http://localhost:9090/hook';

/**
 * @note AddNewRow function makes two requests:
 *  1. Creates a blank row with default values (POST) if current cell is not required cell.
 *  2. Fills cell values (PATCH) if current cell is not required cell else (POST).
 */

// clear server data
async function clearServerData({ request }) {
  // clear stored data in server
  await request.get(hookPath + '/clear');

  // ensure stored message count is 0
  const response = await request.get(hookPath + '/count');
  expect(await response.json()).toBe(0);
}

async function getWebhookResponses({ request, count = 1 }) {
  let response: { json: () => any };

  // kludge- add delay to allow server to process webhook
  await new Promise(resolve => setTimeout(resolve, 1000));

  // retry since there can be lag between the time the hook is triggered and the time the server receives the request
  for (let i = 0; i < 20; i++) {
    response = await request.get(hookPath + '/count');
    if ((await response.json()) === count) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  expect(await response.json()).toBe(count);

  response = await request.get(hookPath + '/all');
  return await response.json();
}

async function verifyHookTrigger(count: number, value: string | null, request, expectedData?: any) {
  // Retry since there can be lag between the time the hook is triggered and the time the server receives the request
  let response: { json: () => any };

  // retry since there can be lag between the time the hook is triggered and the time the server receives the request
  for (let i = 0; i < 20; i++) {
    response = await request.get(hookPath + '/count');
    if ((await response.json()) === count) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  expect(await response.json()).toBe(count);

  if (count) {
    let response: any;

    // retry since there can be lag between the time the hook is triggered and the time the server receives the request
    for (let i = 0; i < 20; i++) {
      response = await request.get(hookPath + '/last');
      const rspJson = await response.json();
      // console.log('verifyHookTrigger response', value, rspJson);

      if (rspJson?.data?.rows[0]?.Title === value) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const rspJson = await response.json();
    expect(rspJson?.data?.rows[0]?.Title).toBe(value);
    if (expectedData) {
      expect(isSubset(rspJson, expectedData)).toBe(true);
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
  if (enableQuickRun()) test.skip();
  let api: Api<any>;

  // start a server locally for webhook tests

  let dashboard: DashboardPage, webhook: WebhookFormPage;
  let context: NcContext;

  test.beforeAll(async () => {
    await makeServer();
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    webhook = dashboard.webhookForm;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('CRUD', async ({ request, page }) => {
    // Waiting for the server to start
    await page.waitForTimeout(1000);

    // close 'Team & Auth' tab
    await clearServerData({ request });
    await dashboard.treeView.createTable({ title: 'Test', baseTitle: context.base.title });

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
      event: 'On Record Insert',
    });
    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });

    await verifyHookTrigger(1, null, request, buildExpectedResponseData('records.after.insert', null));

    // trigger edit row & delete row
    // verify that the hook is not triggered (count doesn't change in this case)
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(1, null, request);
    await dashboard.grid.clickRow(0);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(1, null, request);

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
      event: 'On Record Update',
    });

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });

    await verifyHookTrigger(2, 'Poole', request, buildExpectedResponseData('records.after.update', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(
      3,
      'Delaware',
      request,
      buildExpectedResponseData('records.after.update', 'Delaware', 'Poole')
    );
    await dashboard.grid.clickRow(0);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(3, 'Delaware', request);

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
      event: 'On Record Delete',
    });
    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });

    await verifyHookTrigger(2, 'Poole', request, buildExpectedResponseData('records.after.update', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(
      3,
      'Delaware',
      request,
      buildExpectedResponseData('records.after.update', 'Delaware', 'Poole')
    );
    await dashboard.grid.clickRow(0);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(4, 'Delaware', request, buildExpectedResponseData('records.after.delete', 'Delaware'));

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
      event: 'On Record Delete',
    });
    await webhook.save();
    await webhook.close();
    await webhook.open({ index: 1 });
    await webhook.configureWebhook({
      title: 'hook-2-modified',
      event: 'On Record Delete',
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
    await dashboard.grid.clickRow(0);
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
    await webhook.delete({ index: 0, wfr: false });
    await webhook.delete({ index: 0, wfr: false });
    await dashboard.grid.topbar.openDataTab();

    await clearServerData({ request });
    await dashboard.grid.addNewRow({
      index: 0,
      columnHeader: 'Title',
      value: 'Poole',
    });
    await verifyHookTrigger(0, '', request);
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await verifyHookTrigger(0, '', request);
    await dashboard.grid.clickRow(0);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(0, '', request);
  });

  test('Conditional webhooks', async ({ request }) => {
    test.slow();

    await clearServerData({ request });
    await dashboard.treeView.createTable({ title: 'Test', baseTitle: context.base.title });

    // after insert hook
    await webhook.create({
      title: 'hook-1',
      event: 'On Record Insert',
    });
    // after insert hook
    await webhook.create({
      title: 'hook-2',
      event: 'On Record Update',
    });
    // after insert hook
    await webhook.create({
      title: 'hook-3',
      event: 'On Record Delete',
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
    await verifyHookTrigger(1, 'Poole', request, buildExpectedResponseData('records.after.update', 'Poole'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(
      2,
      'Poole',
      request,
      buildExpectedResponseData('records.after.update', 'Poole', 'Delaware')
    );
    await dashboard.grid.clickRow(1);
    await dashboard.grid.deleteRow(1);
    await dashboard.rootPage.waitForTimeout(3000);
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
    await verifyHookTrigger(4, 'Delaware', request, buildExpectedResponseData('records.after.insert', 'Delaware'));
    await dashboard.grid.editRow({ index: 0, value: 'Delaware' });
    await dashboard.grid.editRow({ index: 1, value: 'Poole' });
    await verifyHookTrigger(
      6,
      'Poole',
      request,
      buildExpectedResponseData('records.after.update', 'Poole', 'Delaware')
    );
    await dashboard.grid.clickRow(1);
    await dashboard.grid.deleteRow(1);
    await dashboard.grid.deleteRow(0);
    await verifyHookTrigger(8, 'Delaware', request, buildExpectedResponseData('records.after.delete', 'Delaware'));
  });

  test('Bulk operations', async ({ request, page }) => {
    async function verifyBulkOperationTrigger(rsp, type) {
      // kludge- add delay to allow server to process webhook
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < rsp.length; i++) {
        expect(rsp[i].type).toBe(type);
        expect(rsp[i].data.table_name).toBe('Test');

        // only for insert, rows inserted will not be returned in response. just count
        if (type === 'records.after.bulkInsert') {
          expect(rsp[i].data.rows_inserted).toBe(50);
        } else if (type === 'records.after.bulkUpdate') {
          expect(rsp[i].data.rows.length).toBe(50);
          expect(rsp[i].data.previous_rows.length).toBe(50);

          // verify records
          for (let j = 0; j < rsp[i].data.rows.length; j++) {
            expect(+rsp[i].data.rows[j].Number).toBe(111 * (j + 1));
            expect(+rsp[i].data.previous_rows[j].Number).toBe(100 * (j + 1));
          }
        } else if (type === 'records.after.bulkDelete') {
          expect(rsp[i].data.rows.length).toBe(50);

          // verify records
          for (let j = 0; j < rsp[i].data.rows.length; j++) {
            expect(+rsp[i].data.rows[j].Number).toBe(111 * (j + 1));
          }
        }
      }
    }

    // Waiting for the server to start
    await page.waitForTimeout(1000);

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
    let base, table;

    try {
      base = await api.base.read(context.base.id);
      table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'Test',
        title: 'Test',
        columns: columns,
      });
    } catch (e) {
      console.error(e);
    }

    await page.reload();
    await dashboard.treeView.openTable({ title: 'Test' });

    // create after insert webhook
    await webhook.create({
      title: 'hook-1',
      event: 'On Multiple Record Insert',
    });
    await webhook.create({
      title: 'hook-1',
      event: 'On Multiple Record Update',
    });
    await webhook.create({
      title: 'hook-1',
      event: 'On Multiple Record Delete',
    });

    await clearServerData({ request });
    const rowAttributesForInsert = Array.from({ length: 50 }, (_, i) => ({
      Id: i + 1,
      Number: (i + 1) * 100,
    }));
    await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributesForInsert);
    await page.reload();
    let rsp = await getWebhookResponses({ request, count: 1 });
    await verifyBulkOperationTrigger(rsp, 'records.after.bulkInsert');

    // bulk update all rows
    await clearServerData({ request });
    // build rowAttributes for update to contain all the ids & their value set to 100
    const rowAttributesForUpdate = Array.from({ length: 50 }, (_, i) => ({
      Id: i + 1,
      Number: (i + 1) * 111,
    }));

    await api.dbTableRow.bulkUpdate('noco', context.base.id, table.id, rowAttributesForUpdate);
    await page.reload();
    // 50 records updated, we expect 2 webhook responses
    rsp = await getWebhookResponses({ request, count: 1 });
    await verifyBulkOperationTrigger(rsp, 'records.after.bulkUpdate');

    // bulk delete all rows
    await clearServerData({ request });
    const rowAttributesForDelete = Array.from({ length: 50 }, (_, i) => ({ Id: i + 1 }));

    await api.dbTableRow.bulkDelete('noco', context.base.id, table.id, rowAttributesForDelete);
    await page.reload();
    rsp = await getWebhookResponses({ request, count: 1 });
    await verifyBulkOperationTrigger(rsp, 'records.after.bulkDelete');
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
      const base = await api.base.read(context.base.id);
      cityTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
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
      await api.dbTableRow.bulkCreate('noco', context.base.id, cityTable.id, cityRowAttributes);
    } catch (e) {
      console.error(e);
    }

    try {
      const countryRowAttributes = [
        { Country: 'India', CountryCode: 1 },
        { Country: 'USA', CountryCode: 2 },
        { Country: 'UK', CountryCode: 3 },
        { Country: 'Australia', CountryCode: 4 },
      ];
      await api.dbTableRow.bulkCreate('noco', context.base.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      countryTable = await api.dbTableColumn.create(countryTable.id, {
        title: 'CityList',
        uidt: UITypes.Links,
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
    } catch (e) {
      console.error(e);
    }

    try {
      // Create links
      await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.title, 1, 'hm', 'CityList', '1');
      await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.title, 1, 'hm', 'CityList', '2');
      await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.title, 2, 'hm', 'CityList', '3');
      await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.title, 3, 'hm', 'CityList', '4');
      //
      // create formula column
      await api.dbTableColumn.create(countryTable.id, {
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
      event: 'On Record Update',
    });

    // clear server data
    await clearServerData({ request });

    // edit first record
    await dashboard.grid.editRow({ index: 0, columnHeader: 'Country', value: 'INDIA', networkValidation: false });
    const rsp = await getWebhookResponses({ request, count: 1 });

    const expectedData = {
      type: 'records.after.update',
      data: {
        table_name: 'Country',
        previous_rows: [
          {
            Id: 1,
            Country: 'India',
            CountryCode: 1,
            CityList: 2,
            CityCodeRollup: 2,
            CityCodeFormula: 100,
            CityCodeLookup: [23, 33],
          },
        ],
        rows: [
          {
            Id: 1,
            Country: 'INDIA',
            CountryCode: 1,
            CityList: 2,
            CityCodeRollup: 2,
            CityCodeFormula: 100,
            CityCodeLookup: [23, 33],
          },
        ],
      },
    };

    // Webhook response type for lookup is different for PG between CE & EE
    if (isEE()) {
      // @ts-ignore
      expectedData.data.previous_rows[0].CityCodeLookup = [23, 33];
      // @ts-ignore
      expectedData.data.rows[0].CityCodeLookup = [23, 33];
    }

    if (isSqlite(context) || isMysql(context)) {
      // @ts-ignore
      expectedData.data.previous_rows[0].CountryCode = 1;
      // @ts-ignore
      expectedData.data.rows[0].CountryCode = 1;
      // @ts-ignore
      expectedData.data.previous_rows[0].CityCodeRollup = 2;
      // @ts-ignore
      expectedData.data.rows[0].CityCodeRollup = 2;
      // @ts-ignore
      expectedData.data.previous_rows[0].CityCodeLookup = [23, 33];
      // @ts-ignore
      expectedData.data.rows[0].CityCodeLookup = [23, 33];
      // @ts-ignore
      expectedData.data.previous_rows[0].CityList = 2;
      // @ts-ignore
      expectedData.data.rows[0].CityList = 2;

      if (isMysql(context)) {
        // @ts-ignore
        expectedData.data.previous_rows[0].CityCodeFormula = '100';
        // @ts-ignore
        expectedData.data.rows[0].CityCodeFormula = '100';
      }
    }

    expect(isSubset(rsp[0], expectedData)).toBe(true);
  });

  test('Delete operations', async ({ request }) => {
    async function verifyDeleteOperation(rsp, type, deleteCount) {
      // kludge- add delay to allow server to process webhook
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(rsp[rsp.length - 1].type).toBe(type);
      expect(rsp[rsp.length - 1].data.table_name).toBe('Test');

      if (deleteCount !== null) {
        expect(rsp[rsp.length - 1].data.rows.length).toBe(deleteCount);
      }
    }

    test.slow();

    await clearServerData({ request });
    await dashboard.treeView.createTable({ title: 'Test', baseTitle: context.base.title });

    // after insert hook
    await webhook.create({
      title: 'hook-1',
      event: 'On Record Delete',
    });
    // after insert hook
    await webhook.create({
      title: 'hook-2',
      event: 'On Multiple Record Delete',
    });

    const titles = ['Poole', 'Delaware', 'Pabalo', 'John', 'Vicky', 'Tom'];
    for (let i = 0; i < titles.length; i++) {
      await dashboard.grid.addNewRow({
        index: i,
        columnHeader: 'Title',
        value: titles[i],
      });
    }

    await dashboard.grid.clickRow(0);

    // Select one record and delete
    await dashboard.grid.selectRow(0);
    await dashboard.grid.deleteSelectedRows();
    let rsp = await getWebhookResponses({ request, count: 1 });

    await verifyDeleteOperation(rsp, 'records.after.delete', null);

    // Select multiple records and delete
    await dashboard.grid.selectRow(0);
    await dashboard.grid.selectRow(1);
    await dashboard.grid.deleteSelectedRows();
    rsp = await getWebhookResponses({ request, count: 2 });

    await verifyDeleteOperation(rsp, 'records.after.bulkDelete', 2);

    // Right click and delete record
    await dashboard.grid.deleteRow(0);
    rsp = await getWebhookResponses({ request, count: 3 });

    await verifyDeleteOperation(rsp, 'records.after.delete', null);

    // Select range and delete records
    await dashboard.grid.selectRange({
      start: { index: 0, columnHeader: 'Title' },
      end: { index: 1, columnHeader: 'Title' },
    });

    await dashboard.grid.deleteRow(0);
    rsp = await getWebhookResponses({ request, count: 4 });

    await verifyDeleteOperation(rsp, 'records.after.bulkDelete', 2);
  });
});
