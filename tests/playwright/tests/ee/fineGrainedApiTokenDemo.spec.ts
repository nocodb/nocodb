/**
 * Fine-Grained API Token — Video Demo
 *
 * Records a video walkthrough of the complete token management flow:
 *   1. Navigate to API Tokens page (empty state)
 *   2. Create a full-access token through the wizard
 *   3. Create a second read-only token through the wizard
 *   4. View both tokens in the list (scope, permissions, expiry, prefix)
 *   5. Toggle a token on/off
 *   6. Delete a token
 *
 * Run:  EE=true npx playwright test tests/ee/fineGrainedApiTokenDemo.spec.ts
 * Video output:  tests/playwright/output/
 */
import { expect, test } from '@playwright/test';
import setup, { NcContext, unsetup } from '../../setup';
import { Api } from 'nocodb-sdk';

// Enable video recording
test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

test.describe('Fine-Grained API Token — Video Demo', () => {
  let context: NcContext;

  test('Full walkthrough: create, view, toggle, delete', async ({ page }) => {
    test.setTimeout(120_000);

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

    // ── Scene 1: Empty state ──────────────────────────────────────
    await page.goto('/#/account/tokens');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="nc-token-list"]').waitFor({ state: 'visible', timeout: 15000 });
    await pause(2000);

    // ── Scene 2: Create Token #1 — "Production API" with Full access ──
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(800);

    // Step 1 — Name
    const nameInput1 = page.locator('[data-testid="nc-token-name-input"]');
    await nameInput1.click();
    await nameInput1.pressSequentially('Production API Token', { delay: 50 });
    await pause(600);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(800);

    // Step 2 — Scope: keep "All resources"
    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await pause(1000);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(800);

    // Step 3 — Permissions: click "Full access" preset
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await pause(600);
    await page.locator('[data-testid="nc-token-perm-preset-allwrite"]').click();
    await pause(1000);

    // Create
    await page.locator('[data-testid="nc-token-wizard-create"]').click();

    // Result — token shown once
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    const token1 = await page.locator('[data-testid="nc-token-created-value"]').textContent();
    expect(token1).toMatch(/^nc_pat_/);
    await pause(2500);

    // Close wizard
    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
    await pause(1500);

    // Verify token #1 in list
    const row1 = page.locator('[data-testid="nc-token-row"]').filter({ hasText: 'Production API Token' });
    await expect(row1).toBeVisible({ timeout: 10000 });
    await pause(1500);

    // ── Scene 3: Create Token #2 — "Staging Read-Only" with limited permissions ──
    await page.locator('[data-testid="nc-token-create"]').click();
    await page.locator('[data-testid="nc-token-create-wizard"]').waitFor({ state: 'visible', timeout: 10000 });
    await pause(600);

    // Step 1 — Name
    const nameInput2 = page.locator('[data-testid="nc-token-name-input"]');
    await nameInput2.click();
    await nameInput2.pressSequentially('Staging Read-Only', { delay: 50 });
    await pause(600);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(800);

    // Step 2 — Scope: keep "All resources"
    await page.locator('[data-testid="nc-token-scope-picker"]').waitFor({ state: 'visible' });
    await pause(800);
    await page.locator('[data-testid="nc-token-wizard-next"]').click();
    await pause(800);

    // Step 3 — Permissions: click "Read-only" preset
    await page.locator('[data-testid="nc-token-wizard-step-3"]').waitFor({ state: 'visible' });
    await pause(600);
    await page.locator('[data-testid="nc-token-perm-preset-readonly"]').click();
    await pause(1200);

    // Create
    await page.locator('[data-testid="nc-token-wizard-create"]').click();

    // Result — second token
    await page.locator('[data-testid="nc-token-wizard-result"]').waitFor({ state: 'visible', timeout: 15000 });
    const token2 = await page.locator('[data-testid="nc-token-created-value"]').textContent();
    expect(token2).toMatch(/^nc_pat_/);
    await pause(2000);

    // Close wizard
    await page.locator('[data-testid="nc-token-wizard-done"]').click({ force: true });
    await pause(1500);

    // ── Scene 4: View both tokens in the list ─────────────────────
    const row2 = page.locator('[data-testid="nc-token-row"]').filter({ hasText: 'Staging Read-Only' });
    await expect(row1).toBeVisible({ timeout: 10000 });
    await expect(row2).toBeVisible({ timeout: 10000 });
    await pause(3000); // Let viewer see both tokens with columns

    // ── Scene 5: Toggle token #2 off and back on ──────────────────
    const toggle = row2.locator('[data-testid="nc-token-toggle-enabled"]');
    await expect(toggle).toBeVisible({ timeout: 5000 });

    await toggle.click();
    await page.waitForLoadState('networkidle');
    await pause(1500);

    await toggle.click();
    await page.waitForLoadState('networkidle');
    await pause(1500);

    // ── Scene 6: Delete token #1 ─────────────────────────────────
    const deleteIcon = row1.locator('[data-testid="nc-token-row-action-icon"]');
    await deleteIcon.click();
    await pause(1000);

    const confirmBtn = page.locator('[data-testid="nc-delete-modal-delete-btn"]');
    await expect(confirmBtn).toBeVisible();
    await pause(1200);

    await confirmBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(1500);

    // Token #1 gone, token #2 remains
    await expect(page.locator('[data-testid="nc-token-row"]').filter({ hasText: 'Production API Token' })).toHaveCount(
      0,
      { timeout: 10000 }
    );
    await expect(row2).toBeVisible();
    await pause(2500); // Final view

    // ── End ───────────────────────────────────────────────────────
  });

  test.afterAll(async () => {
    if (context) await unsetup(context);
  });
});
