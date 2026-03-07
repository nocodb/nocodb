/**
 * Fine-Grained API Token — Full Demo (with Edit)
 *
 * Records a comprehensive video walkthrough including token editing:
 *   1. Navigate to API Tokens page (empty state)
 *   2. Create Token #1 — "Production API" with Full access (all write)
 *   3. Create Token #2 — "CI/CD Pipeline" with Read-only preset
 *   4. Create Token #3 — "Monitoring Bot" with custom per-category permissions
 *   5. View all three tokens in the list
 *   6. Edit Token #2 — rename + change permissions from Read-only to Full data access
 *   7. Cancel a wizard mid-flow (nothing created)
 *   8. Toggle token #3 off and back on
 *   9. Delete token #1 via three-dot menu
 *  10. Final view — two remaining tokens
 *
 * Run:  EE=true npx playwright test tests/ee/fineGrainedApiTokenDemoWithEdit.spec.ts
 * Video output:  /tmp/pw-video/
 */
import { expect, test } from '@playwright/test';
import setup, { NcContext, unsetup } from '../../setup';
import { Api } from 'nocodb-sdk';

// Enable video recording at good resolution
test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

// Find a token row by name — NcTable uses <tr> elements
const findTokenRow = (page, name: string) => {
  return page.locator('tr.nc-table-row').filter({ hasText: name });
};

test.describe('Fine-Grained API Token — Full Demo with Edit', () => {
  let context: NcContext;

  test('Full walkthrough: create, edit, cancel, toggle, delete', async ({ page }) => {
    test.setTimeout(240_000);

    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    // Clean slate — delete any existing tokens
    try {
      const response: any = await api.request({ path: '/api/v3/meta/tokens', method: 'GET' });
      for (const token of response?.list || []) {
        try {
          await api.request({ path: `/api/v3/meta/tokens/${token.id}`, method: 'DELETE' });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    // ════════════════════════════════════════════════════════════════
    // Scene 1: Navigate to API Tokens — Empty State
    // ════════════════════════════════════════════════════════════════
    await page.goto('/#/account/tokens');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
    await pause(3000);

    // ════════════════════════════════════════════════════════════════
    // Scene 2: Create Token #1 — "Production API" with Full Access
    // ════════════════════════════════════════════════════════════════
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(1200);

    const nameInput1 = page.locator('[data-testid="nc-token-name-input"]');
    await nameInput1.click();
    await nameInput1.pressSequentially('Production API Token', { delay: 60 });
    await pause(1000);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1200);

    // Step 2 — Scope: keep "All resources"
    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await pause(1500);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1200);

    // Step 3 — Full access preset
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await pause(1000);
    await page.locator('[data-testid="nc-token-perm-preset-allwrite"]').click();
    await pause(1500);

    await page.locator('[data-testid="nc-token-wizard-create"]').click();
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    await pause(3000);

    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
    await pause(2000);

    const row1 = findTokenRow(page, 'Production API Token');
    await expect(row1).toBeVisible({ timeout: 10000 });

    // ════════════════════════════════════════════════════════════════
    // Scene 3: Create Token #2 — "CI/CD Pipeline" with Read-Only
    // ════════════════════════════════════════════════════════════════
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(1000);

    const nameInput2 = page.locator('[data-testid="nc-token-name-input"]');
    await nameInput2.click();
    await nameInput2.pressSequentially('CI/CD Pipeline', { delay: 60 });
    await pause(800);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1000);

    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await pause(1000);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1000);

    // Read-only preset
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await pause(800);
    await page.locator('[data-testid="nc-token-perm-preset-readonly"]').click();
    await pause(1500);

    await page.locator('[data-testid="nc-token-wizard-create"]').click();
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    await pause(3000);

    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
    await pause(2000);

    // ════════════════════════════════════════════════════════════════
    // Scene 4: Create Token #3 — "Monitoring Bot" with Custom Permissions
    // ════════════════════════════════════════════════════════════════
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(1000);

    const nameInput3 = page.locator('[data-testid="nc-token-name-input"]');
    await nameInput3.click();
    await nameInput3.pressSequentially('Monitoring Bot', { delay: 60 });
    await pause(800);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1000);

    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await pause(1000);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(1000);

    // Start with Read-only then customize
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await pause(800);
    await page.locator('[data-testid="nc-token-perm-preset-readonly"]').click();
    await pause(1200);

    // Customize: records to Write
    const recordsWriteRadio = page.locator('[data-testid="nc-token-perm-records-write"]');
    if (await recordsWriteRadio.isVisible()) {
      await recordsWriteRadio.click();
      await pause(1000);
    }

    // Webhooks to Write
    const webhooksWriteRadio = page.locator('[data-testid="nc-token-perm-webhooks-write"]');
    if (await webhooksWriteRadio.isVisible()) {
      await webhooksWriteRadio.click();
      await pause(1000);
    }
    await pause(1500);

    await page.locator('[data-testid="nc-token-wizard-create"]').click();
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    await pause(3000);

    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
    await pause(2000);

    // ════════════════════════════════════════════════════════════════
    // Scene 5: View all three tokens in the list
    // ════════════════════════════════════════════════════════════════
    const row2 = findTokenRow(page, 'CI/CD Pipeline');
    const row3 = findTokenRow(page, 'Monitoring Bot');
    await expect(row1).toBeVisible({ timeout: 10000 });
    await expect(row2).toBeVisible({ timeout: 10000 });
    await expect(row3).toBeVisible({ timeout: 10000 });
    await pause(4000);

    // ════════════════════════════════════════════════════════════════
    // Scene 6: Edit Token #2 — rename + change permissions
    // ════════════════════════════════════════════════════════════════
    // Open three-dot menu on CI/CD Pipeline row
    await row2.locator('[data-testid="nc-token-row-action-icon"]').click();
    await pause(500);

    // Click "Edit" from dropdown
    await page.locator('[data-testid="nc-token-row-edit-icon"]').click();

    // Wait for edit modal
    await page.locator('[data-testid="nc-token-edit-modal"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(2000);

    // Change the name
    const editNameInput = page.locator('[data-testid="nc-token-edit-name"]');
    await editNameInput.click();
    await editNameInput.clear();
    await pause(500);
    await editNameInput.pressSequentially('CI/CD Pipeline (Updated)', { delay: 50 });
    await pause(1500);

    // Change expiry to 30 days
    await page.locator('[data-testid="nc-token-edit-expiry"]').click();
    await pause(500);
    await page.locator('.ant-select-item-option').filter({ hasText: '30 days from now' }).click();
    await pause(1500);

    // Toggle permissions on (if not already)
    const permsToggle = page.locator('[data-testid="nc-token-edit-perms-toggle"]');
    const isPermsOn = await permsToggle.isChecked().catch(() => false);
    if (!isPermsOn) {
      await permsToggle.click();
      await pause(1000);
    }

    // Click "Full data access" preset
    const fullDataPreset = page.locator('[data-testid="nc-token-perm-preset-fulldata"]');
    if (await fullDataPreset.isVisible()) {
      await fullDataPreset.click();
      await pause(2000);
    }

    // Save
    await page.locator('[data-testid="nc-token-edit-save"]').click();
    await pause(2000);

    // Verify the updated name appears in list
    const updatedRow = findTokenRow(page, 'CI/CD Pipeline (Updated)');
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await pause(3000);

    // ════════════════════════════════════════════════════════════════
    // Scene 7: Cancel wizard — nothing is created
    // ════════════════════════════════════════════════════════════════
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(800);

    const nameInputCancel = page.locator('[data-testid="nc-token-name-input"]');
    await nameInputCancel.click();
    await nameInputCancel.pressSequentially('This Will Be Cancelled', { delay: 50 });
    await pause(1200);

    await page.locator('[data-testid="nc-token-wizard-cancel"]').click();
    await pause(1500);

    await expect(page.locator('[data-testid="nc-token-create-wizard"]')).not.toBeVisible();
    await pause(2000);

    // ════════════════════════════════════════════════════════════════
    // Scene 8: Toggle token #3 off and back on
    // ════════════════════════════════════════════════════════════════
    const toggle3 = row3.locator('[data-testid="nc-token-toggle-enabled"]');
    await expect(toggle3).toBeVisible({ timeout: 5000 });

    await toggle3.click();
    await page.waitForLoadState('networkidle');
    await pause(2000);

    await toggle3.click();
    await page.waitForLoadState('networkidle');
    await pause(2000);

    // ════════════════════════════════════════════════════════════════
    // Scene 9: Delete token #1 via three-dot menu
    // ════════════════════════════════════════════════════════════════
    await row1.locator('[data-testid="nc-token-row-action-icon"]').click();
    await pause(500);
    await page.locator('.ant-dropdown:visible .nc-menu-item:has-text("Delete")').click();
    await pause(1500);

    const confirmBtn = page.locator('[data-testid="nc-delete-modal-delete-btn"]');
    await expect(confirmBtn).toBeVisible();
    await pause(1500);

    await confirmBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(2000);

    // ════════════════════════════════════════════════════════════════
    // Scene 10: Final view — two remaining tokens
    // ════════════════════════════════════════════════════════════════
    await expect(findTokenRow(page, 'Production API Token')).toHaveCount(0, { timeout: 10000 });
    await expect(updatedRow).toBeVisible();
    await expect(row3).toBeVisible();
    await pause(4000);
  });

  test.afterAll(async () => {
    if (context) await unsetup(context);
  });
});
