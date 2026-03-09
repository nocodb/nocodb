import { test } from '@playwright/test';
import setup, { NcContext, unsetup } from '../../setup';
import { Api } from 'nocodb-sdk';

const IMG_DIR =
  '/Users/pranavc/xgene/worktree/fine-grained-api-token/packages/nocodb/help/api-token-docs/public/img/v2/account-settings';

test('screenshot token UI', async ({ page }) => {
  test.setTimeout(120_000);
  const ctx = await setup({ page, isEmptyProject: true, isSuperUser: true });
  const api = new Api({ baseURL: 'http://localhost:8080/', headers: { 'xc-auth': ctx.token } });

  // Clean existing tokens
  try {
    const r: any = await api.request({ path: '/api/v3/meta/tokens', method: 'GET' });
    for (const t of r?.list || []) {
      try {
        await api.request({ path: `/api/v3/meta/tokens/${t.id}`, method: 'DELETE' });
      } catch {}
    }
  } catch {}

  // Create sample tokens with new permission categories
  await api.request({
    path: '/api/v3/meta/tokens',
    method: 'POST',
    body: { title: 'Production API', expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
  });
  await api.request({
    path: '/api/v3/meta/tokens',
    method: 'POST',
    body: {
      title: 'CI Pipeline (Read-Only)',
      scopes: [
        {
          resource_type: 'base',
          resource_id: ctx.base.id,
          permissions: {
            records: 'read',
            tables: 'read',
            fields: 'read',
            views: 'read',
            base: 'read',
            comments: 'read',
            webhooks: 'none',
            users: 'none',
          },
        },
      ],
    },
  });
  await api.request({ path: '/api/v3/meta/tokens', method: 'POST', body: { title: 'Monitoring Bot' } });

  // Screenshot 01: Token list
  await page.goto('/#/account/tokens');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${IMG_DIR}/01-token-list.png`, fullPage: true });

  // Screenshot 03: Wizard step 1 — Name & Expiry (dropdown → Fine-grained token)
  await page.locator('[data-testid="nc-token-create"]').click();
  await page.locator('[data-testid="nc-token-create-fine-grained"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="nc-token-create-fine-grained"]').click();
  await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/03-wizard-step1-name-expiry.png` });

  // Screenshot 04: Wizard step 2 — Scope
  await page.locator('[data-testid="nc-token-name-input"]').fill('Demo Token');
  await page.locator('[data-testid="nc-token-wizard-next"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/04-wizard-step2-scope.png` });

  // Screenshot 05: Wizard step 3 — Permissions (default/all none)
  await page.locator('[data-testid="nc-token-wizard-next"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/05-wizard-step3-permissions-default.png` });

  // Screenshot 06: Read-only preset
  await page.locator('[data-testid="nc-token-perm-preset-readonly"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/06-wizard-step3-readonly-preset.png` });

  // Screenshot 07: Full access preset
  await page.locator('[data-testid="nc-token-perm-preset-allwrite"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/07-wizard-step3-fullaccess-preset.png` });

  // Screenshot 08: Custom permissions
  await page.locator('[data-testid="nc-token-perm-records-write"]').click();
  await page.locator('[data-testid="nc-token-perm-tables-read"]').click();
  await page.locator('[data-testid="nc-token-perm-fields-read"]').click();
  await page.locator('[data-testid="nc-token-perm-views-read"]').click();
  await page.locator('[data-testid="nc-token-perm-base-none"]').click();
  await page.locator('[data-testid="nc-token-perm-comments-read"]').click();
  await page.locator('[data-testid="nc-token-perm-webhooks-none"]').click();
  await page.locator('[data-testid="nc-token-perm-users-none"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/08-wizard-step3-custom-permissions.png` });

  // Screenshot 09: Token created — result step
  await page.locator('[data-testid="nc-token-wizard-create"]').click();
  await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${IMG_DIR}/09-wizard-step4-token-created.png` });

  // Close wizard and go back to list
  await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
  await page.waitForTimeout(1500);

  // Screenshot 02: Row actions menu
  const row = page.locator('tr.nc-table-row').filter({ hasText: 'Production API' });
  await row.locator('[data-testid="nc-token-row-action-icon"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${IMG_DIR}/02-token-row-actions.png` });

  // Screenshot 10: Edit modal
  await page.locator('[data-testid="nc-token-row-edit-icon"]').click();
  await page.locator('[data-testid="nc-token-edit-modal"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/10-edit-modal.png` });

  // Screenshot 11: Edit modal with permissions toggled on
  await page.locator('[data-testid="nc-token-edit-perms-toggle"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG_DIR}/11-edit-modal-permissions.png` });

  await unsetup(ctx);
});
