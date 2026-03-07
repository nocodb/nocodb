/**
 * Fine-Grained API Token E2E Tests
 *
 * Stories:
 * 1. A user creates a token using the wizard (org scope, no permissions)
 * 2. A user disables and re-enables a token with expiry
 * 3. A user deletes a token
 * 4. A user cancels token creation mid-wizard
 * 5. A user verifies token list displays scope, permissions and expiry
 */
import { expect, test } from '@playwright/test';
import { AccountPage } from '../../pages/Account';
import setup, { NcContext, unsetup } from '../../setup';
import { Api } from 'nocodb-sdk';

// Helpers
const navigateToTokens = async page => {
  await page.goto('/#/account/tokens');
  await page.waitForLoadState('networkidle');
  // Retry navigation if page didn't load (setup flakiness)
  try {
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    await page.goto('/#/account/tokens');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
  }
};

const openWizard = async page => {
  const createBtn = page.locator('[data-testid="nc-token-create"]');
  await createBtn.waitFor({ state: 'visible' });
  await createBtn.click();
  await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
};

// Find a token row by name — NcTable uses <tr> elements
const findTokenRow = (page, name: string) => {
  return page.locator('tr.nc-table-row').filter({ hasText: name });
};

const cleanupAllTokens = async (api: Api<any>) => {
  // Use V3 list to get all token IDs, then delete each via V3
  try {
    const response: any = await api.request({
      path: '/api/v3/meta/tokens',
      method: 'GET',
    });
    for (const token of response?.list || []) {
      try {
        await api.request({
          path: `/api/v3/meta/tokens/${token.id}`,
          method: 'DELETE',
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // Fallback — V1 cleanup
    const apiTokens = await api.orgTokens.list();
    for (const token of apiTokens.list) {
      try {
        await api.orgTokens.delete(token.id);
      } catch {
        // ignore
      }
    }
  }
};

test.describe('Fine-Grained API Token Stories', () => {
  // All tests share the same super user account, so run serially to avoid cleanup races
  test.describe.configure({ mode: 'serial' });
  let context: NcContext;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    await cleanupAllTokens(api);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // ─── Story 1: Create a token through the wizard ───

  test('Story: User creates a token through the 3-step wizard', async ({ page }) => {
    test.slow();

    // User navigates to the API Tokens page
    await navigateToTokens(page);

    // User clicks "Add new token" to open the creation wizard
    await openWizard(page);

    // Step 1: User enters a descriptive name
    await page.locator('[data-testid="nc-token-name-input"]').fill('My Integration Token');
    await page.locator('[data-testid="nc-token-wizard-next"]').click();

    // Step 2: User keeps the default "All resources" scope and proceeds
    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="nc-token-wizard-next"]').click();

    // Step 3: User clicks "Full access" preset and creates the token
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="nc-token-perm-preset-allwrite"]').click();
    await page.locator('[data-testid="nc-token-wizard-create"]').click();

    // Result screen: Token is shown once — starts with nc_pat_
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    const tokenText = await page.locator('[data-testid="nc-token-created-value"]').textContent();
    expect(tokenText).toMatch(/^nc_pat_/);

    // User closes the wizard
    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true, timeout: 10000 });
    await page.waitForTimeout(1000);
    const row = findTokenRow(page, 'My Integration Token');
    await expect(row).toBeVisible({ timeout: 10000 });
  });

  // ─── Story 2: Disable and re-enable a token ───

  test('Story: User disables a token and then re-enables it', async ({ page }) => {
    test.slow();

    // Pre-create a fine-grained token with expiry (so toggle switch appears)
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: {
        title: 'Togglable Token',
        expiry: futureDate,
      },
    });

    await navigateToTokens(page);

    // User finds the token row
    const row = findTokenRow(page, 'Togglable Token');
    await expect(row).toBeVisible({ timeout: 10000 });

    // User sees the toggle switch (visible because token has expiry = fine-grained)
    const toggle = row.locator('[data-testid="nc-token-toggle-enabled"]');
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // User clicks the toggle to disable
    await toggle.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // User clicks toggle again to re-enable
    await toggle.click();
    await page.waitForLoadState('networkidle');
  });

  // ─── Story 3: Delete a token ───

  test('Story: User deletes a token and confirms it disappears from the list', async ({ page }) => {
    test.slow();

    // Pre-create a token via API
    await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: { title: 'Expendable Token' },
    });

    await navigateToTokens(page);

    // User locates the token
    const row = findTokenRow(page, 'Expendable Token');
    await expect(row).toBeVisible({ timeout: 10000 });

    // User clicks the three-dot menu
    await row.locator('[data-testid="nc-token-row-action-icon"]').click();

    // User clicks "Delete" from the dropdown
    await page.locator('.nc-menu-item:has-text("Delete")').click();

    // Confirmation modal appears — user clicks "Delete"
    const confirmBtn = page.locator('[data-testid="nc-delete-modal-delete-btn"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Token is gone from the list
    await page.waitForLoadState('networkidle');
    await expect(findTokenRow(page, 'Expendable Token')).toHaveCount(0, {
      timeout: 10000,
    });
  });

  // ─── Story 4: Cancel wizard mid-flow ───

  test('Story: User opens the wizard, types a name, then cancels — nothing is created', async ({ page }) => {
    await navigateToTokens(page);
    await openWizard(page);

    // User types a name but changes their mind
    await page.locator('[data-testid="nc-token-name-input"]').fill('Never Created Token');

    // User clicks Cancel
    await page.locator('[data-testid="nc-token-wizard-cancel"]').click();

    // Wizard closes
    await expect(page.locator('[data-testid="nc-token-create-wizard"]')).not.toBeVisible();
  });

  // ─── Story 5: Verify list columns for a scoped token ───

  test('Story: User creates a scoped token via API and verifies the list displays scope and permissions', async ({
    page,
  }) => {
    test.slow();

    // Create a fully-configured token via API
    await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: {
        title: 'Detailed Token',
        scopes: [
          {
            resource_type: 'base',
            resource_id: context.base.id,
            permissions: {
              records: 'write',
              tables: 'read',
              fields: 'read',
              views: 'read',
              comments: 'none',
              webhooks: 'none',
              extensions: 'none',
              base: 'none',
            },
          },
        ],
      },
    });

    await navigateToTokens(page);

    // User sees the token in the list
    const row = findTokenRow(page, 'Detailed Token');
    await expect(row).toBeVisible({ timeout: 10000 });

    // Details show scope info ("1 base")
    await expect(row.locator('[data-testid="nc-token-scope"]')).toContainText('1 base');

    // Permissions shows a summary
    const permsText = await row.locator('[data-testid="nc-token-permissions"]').textContent();
    expect(permsText).toBeTruthy();

    // Toggle switch is visible (fine-grained token)
    await expect(row.locator('[data-testid="nc-token-toggle-enabled"]')).toBeVisible();
  });
});
