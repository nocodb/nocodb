import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { WebhookFormPage } from '../../../pages/Dashboard/WebhookForm';
import makeServer from '../../../setup/server';

const hookPath = 'http://localhost:9090/hook';

async function clearServerData({ request }) {
  await request.get(hookPath + '/clear');

  const response = await request.get(hookPath + '/count');
  expect(await response.json()).toBe(0);
}

test.describe('Button column', () => {
  let dashboard: DashboardPage, webhook: WebhookFormPage;
  let context: NcContext;

  test.beforeAll(async () => {
    await makeServer();
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);

    webhook = dashboard.webhookForm;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create and verify Button Column,', async ({ context, request, page }) => {
    await page.waitForTimeout(1000);

    await dashboard.treeView.openTable({ title: 'Country' });

    await clearServerData({ request });

    await webhook.create({
      title: 'hook-1',
      event: 'Manual Trigger',
    });
    await clearServerData({ request });

    await dashboard.grid.column.create({
      title: 'Button',
      type: 'Button',
      buttonType: 'Run Webhook',
      webhookIndex: 0,
    });

    await dashboard.grid.cell.button.triggerWebhook({
      index: 0,
      columnHeader: 'Button',
    });

    await page.waitForTimeout(1000);

    let response: { json: () => any };

    for (let i = 0; i < 20; i++) {
      response = await request.get(hookPath + '/count');
      if ((await response.json()) === 1) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    expect(await response.json()).toBe(1);
  });
});
