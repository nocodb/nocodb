/**
 * Fine-Grained API Token E2E Tests
 *
 * Stories:
 * 1. A user creates a token using the single-page form
 * 2. A user disables and re-enables a token
 * 3. A user deletes a token
 * 4. A user cancels token creation
 * 5. A user verifies token list displays correct info
 */
import { expect, test } from '@playwright/test';
import { AccountPage } from '../../pages/Account';
import setup, { NcContext, unsetup } from '../../setup';
import { Api } from 'nocodb-sdk';

// Helpers
const navigateToTokens = async page => {
  await page.goto('/account/tokens');
  await page.waitForLoadState('networkidle');
  try {
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    await page.goto('/account/tokens');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
  }
};

const cleanupAllTokens = async (api: Api<any>) => {
  try {
    const apiTokens = await api.orgTokens.list();
    for (const token of apiTokens.list) {
      try {
        await api.orgTokens.delete(token.id);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
};

test.describe('Fine-Grained API Token Stories', () => {
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

  // ─── Story 1: Create a token through the single-page form ───

  test('Story: User creates a token through the single-page form', async ({ page }) => {
    test.slow();

    await navigateToTokens(page);

    // Click "Create new token" — navigates to /account/tokens/new
    await page.locator('[data-testid="nc-token-create"]').first().click();

    // Wait for the create form
    await page.locator('[data-testid="nc-token-create-form"]').waitFor({ state: 'visible', timeout: 10000 });

    // Fill name
    await page.locator('[data-testid="nc-token-name-input"]').fill('My Integration Token');

    // Add permission (optional — form allows creation with just name + scope)
    const addPermBtn = page.locator('[data-testid="nc-token-perm-add"]');
    if (await addPermBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Permissions section is visible (EE licensed)
      await addPermBtn.click();
      // Select first available category from dropdown
      const firstCategory = page.locator('.nc-perm-dropdown-item').first();
      if (await firstCategory.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstCategory.click();
      }
    }

    // Add a base scope — click "Add all resources" if visible
    const addAllBtn = page.locator('[data-testid="nc-token-scope-add-all"]');
    if (await addAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addAllBtn.click();
    }

    // Click "Create token"
    await page.locator('[data-testid="nc-token-create-btn"]').click();

    // Result modal — token is shown once, starts with nc_pat_
    await page.locator('[data-testid="nc-token-result-modal"]').waitFor({ state: 'visible', timeout: 15000 });
    const tokenText = await page.locator('[data-testid="nc-token-created-value"]').textContent();
    expect(tokenText).toMatch(/^nc_pat_/);

    // Copy and click Done
    await page.locator('[data-testid="nc-token-copy-btn"]').click();
    await page.locator('[data-testid="nc-token-result-modal"] .nc-modal-confirm-ok-btn').click();
    await page.waitForTimeout(1000);

    // Verify token appears in the list
    await expect(page.locator('[data-testid="nc-token-list"]')).toContainText('My Integration Token', {
      timeout: 10000,
    });
  });

  // ─── Story 2: Disable and re-enable a token ───

  test('Story: User disables a token and then re-enables it', async ({ page }) => {
    test.slow();

    // Pre-create a fine-grained token via API
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: {
        title: 'Togglable Token',
        expiry: futureDate,
        scopes: [{ resource_type: 'base', resource_id: context.base.id }],
      },
    });

    await navigateToTokens(page);

    // Find the toggle switch for this token
    const toggle = page.locator('[data-testid="nc-token-toggle-enabled"]');
    await expect(toggle.first()).toBeVisible({ timeout: 5000 });

    // Disable
    await toggle.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Re-enable
    await toggle.first().click();
    await page.waitForLoadState('networkidle');
  });

  // ─── Story 3: Delete a token ───

  test('Story: User deletes a token and confirms it disappears from the list', async ({ page }) => {
    test.slow();

    // Pre-create via API
    await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: {
        title: 'Expendable Token',
        scopes: [{ resource_type: 'base', resource_id: context.base.id }],
      },
    });

    await navigateToTokens(page);

    // Verify token is in list
    await expect(page.locator('[data-testid="nc-token-list"]')).toContainText('Expendable Token', { timeout: 10000 });

    // Click delete icon
    await page.locator('[data-testid="nc-token-row-action-icon"]').first().click();

    // Confirm deletion
    const confirmBtn = page.locator('[data-testid="nc-delete-modal-delete-btn"]');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Token is gone
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="nc-token-list"]')).not.toContainText('Expendable Token', {
      timeout: 10000,
    });
  });

  // ─── Story 4: Cancel creation ───

  test('Story: User opens the form, types a name, then cancels — nothing is created', async ({ page }) => {
    await navigateToTokens(page);

    // Click create
    await page.locator('[data-testid="nc-token-create"]').first().click();
    await page.locator('[data-testid="nc-token-create-form"]').waitFor({ state: 'visible', timeout: 10000 });

    // Type a name
    await page.locator('[data-testid="nc-token-name-input"]').fill('Never Created Token');

    // Cancel
    await page.locator('[data-testid="nc-token-cancel-btn"]').click();

    // Back on list — token should not exist
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('[data-testid="nc-token-list"]')).not.toContainText('Never Created Token');
  });

  // ─── Story 5: Verify list displays token info ───

  test('Story: User verifies token list displays correct info for a scoped token', async ({ page }) => {
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
              tables: 'write',
              fields: 'write',
              views: 'write',
              comments: 'none',
              webhooks: 'none',
              base: 'none',
              users: 'none',
            },
          },
        ],
      },
    });

    await navigateToTokens(page);

    // Token appears in list with name
    await expect(page.locator('[data-testid="nc-token-list"]')).toContainText('Detailed Token', { timeout: 10000 });

    // Toggle switch is visible for fine-grained token
    await expect(page.locator('[data-testid="nc-token-toggle-enabled"]').first()).toBeVisible();
  });
});
