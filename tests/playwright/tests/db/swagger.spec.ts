import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { GridPage } from '../../pages/Dashboard/Grid';
import setup from '../../setup';

test.describe.skip('Table Column Operations', () => {
  let grid: GridPage, dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test('Create column', async () => {
    // access swagger link
    const link = `http://localhost:8080/api/v1/db/meta/projects/${context.project.id}/swagger`;
    await dashboard.rootPage.goto(link, { waitUntil: 'networkidle' });

    const swagger = await dashboard.rootPage;

    // authorize with token information
    await swagger.locator('.btn.authorize').click();
    await swagger.locator('.modal-ux').locator('input').first().fill(context.token);
    await swagger.locator('.btn.modal-btn.auth.authorize.button').first().click();
    await swagger.locator('.close-modal').click();

    // click on the first get request
    await swagger.locator('.opblock.opblock-get').first().click();
    await swagger.locator('.btn.try-out__btn').first().click();
    await swagger.locator('.btn.execute.opblock-control__btn').first().click();

    // verify response status
    const responseStatus = await swagger
      .locator('.responses-table >> tbody')
      .locator('.response-col_status')
      .first()
      .innerText();
    expect(responseStatus).toBe('200');
  });
});
