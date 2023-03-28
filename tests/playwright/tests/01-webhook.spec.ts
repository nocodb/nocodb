import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import makeServer from '../setup/server';
import { WebhookFormPage } from '../pages/Dashboard/WebhookForm';
import { isSubset } from './utils/general';

const hookPath = 'http://localhost:9090/hook';

// clear server data
async function clearServerData({ request }) {
  // clear stored data in server
  await request.get(hookPath + '/clear');

  // ensure stored message count is 0
  const response = await request.get(hookPath + '/count');
  await expect(await response.json()).toBe(0);
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
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    webhook = dashboard.webhookForm;
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
});
