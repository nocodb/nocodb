import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';

test.describe('Scripts - Basic Functionality', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let scriptId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    await dashboard.treeView.createScript({
      title: 'Test Script',
      baseTitle: context.base.title,
    });

    await dashboard.treeView.openScript({
      title: 'Test Script',
      baseTitle: context.base.title,
    });

    await page.waitForTimeout(1000);

    const url = page.url();
    const match = url.match(/\/automations\/([^/]+)/);
    scriptId = match ? match[1] : '';
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Should have complete Scripts UI with all basic functionality', async () => {
    // 1. Verify we're on the script page with correct URL
    await expect(dashboard.scripts.get()).toBeVisible();
    const url = dashboard.rootPage.url();
    expect(url).toContain('/automations/');
    expect(url).toContain(scriptId);

    // 2. Verify Monaco editor is visible and has content
    const isEditorVisible = await dashboard.scripts.isEditorVisible();
    expect(isEditorVisible).toBe(true);
    await dashboard.scripts.verifyEditorHasContent();

    // 3. Test editor toggle functionality
    await dashboard.scripts.verifyEditorToggleState(true);
    await dashboard.scripts.toggleEditor();
    await dashboard.scripts.verifyEditorToggleState(false);
    await dashboard.scripts.toggleEditor();
    await dashboard.scripts.verifyEditorToggleState(true);

    // 4. Verify playground area is visible
    const isPlaygroundVisible = await dashboard.scripts.isPlaygroundVisible();
    expect(isPlaygroundVisible).toBe(true);

    // 5. Test editor content update
    const testCode = `console.log("Hello from test");`;
    await dashboard.scripts.setEditorContent(
      testCode,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );
    await dashboard.scripts.verifyEditorContentContains('Hello from test');

    // 6. Verify run button is visible and enabled
    await dashboard.scripts.topbar.verifyRunButtonEnabled();
  });
});
