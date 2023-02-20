import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import makeServer from '../setup/server';
import { WebhookFormPage } from '../pages/Dashboard/WebhookForm';

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
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    webhook = dashboard.webhookForm;
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
});
