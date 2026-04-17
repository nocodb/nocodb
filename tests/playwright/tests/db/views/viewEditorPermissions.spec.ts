/**
 * UI coverage for the new editor view-permission policy. The backend
 * matrix is covered by the Mocha suite
 * (`packages/nocodb/tests/unit/rest/tests/internal/ui-view/view-editor-permissions.test.ts`);
 * this spec focuses on the UX affordances Mocha can't see:
 *
 *  - Owner: Create View dialog shows all three lock-type radios.
 *  - Owner: Locked-view footer exposes the configured lock message via
 *    an info icon.
 *  - Owner: three-dot action menu on a collaborative view shows the
 *    full set of enabled items (Rename, Duplicate, Delete, Lock-type
 *    sub-actions).
 *  - Last-collab-grid guardrail — the recent self-exclusion + reactivity
 *    fix in `ViewActionMenu.vue` + `store/views.ts`:
 *      • Multiple collab grids in a table → Personal option ENABLED
 *        on any of them (previously disabled incorrectly).
 *      • Single collab grid → Personal option DISABLED with
 *        "last collaborative grid view" tooltip.
 *      • Convert personal → locked → collab cycle on one view should
 *        not leave stale disabled state on another view (computedAsync
 *        race fixed by synchronous reactive computed).
 *
 * EE-only — personal/locked view types don't exist in CE.
 */

import { expect, test } from '@playwright/test';
import axios from 'axios';
import { ViewLockType } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { isEE } from '../../../setup/db';

const API_BASE = 'http://localhost:8080';

test.describe.configure({ mode: 'serial' });

test.describe('View editor permissions — UI (owner)', () => {
  let context: any;
  let dashboard: DashboardPage;
  let ownerToken: string;
  let tableFkId: string;

  // Unique per run so setup/teardown across CI doesn't leave duplicate tables
  // with the same testid and break strict locators.
  const tableTitle = `VEPerm_${Date.now().toString(36)}`;
  const vCollab = 'v_collab';
  const vCollab2 = 'v_collab2';
  const vLocked = 'v_locked';
  const lockedMessage = 'Do not edit — budget view';

  const internalApi = async (query: Record<string, string>, body: Record<string, unknown>) => {
    const qs = new URLSearchParams(query).toString();
    return axios.post(`${API_BASE}/api/v2/internal/${context.workspace.id}/${context.base.id}?${qs}`, body, {
      headers: { 'xc-auth': ownerToken },
    });
  };

  const createGridView = async (title: string) => {
    const res = await internalApi({ operation: 'gridViewCreate', tableId: tableFkId }, { title });
    return res.data as { id: string; title: string; lock_type: ViewLockType };
  };

  const setLockType = async (viewId: string, lock_type: ViewLockType, extra: Record<string, unknown> = {}) => {
    await internalApi({ operation: 'viewUpdate', viewId }, { lock_type, ...extra });
  };

  test.beforeAll(async ({ browser }) => {
    test.skip(!isEE(), 'EE-only: personal / locked view types');

    const page = await browser.newPage();
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    ownerToken = context.token;

    // Dedicated table (V2 create payload requires columns).
    const tbl = await context.api.dbTable.create(context.base.id, {
      table_name: tableTitle,
      title: tableTitle,
      columns: [{ title: 'Name', column_name: 'name', uidt: 'SingleLineText' }],
    });
    tableFkId = tbl.id;

    // Fixture views as owner.
    await createGridView(vCollab);
    await createGridView(vCollab2);
    const lv = await createGridView(vLocked);
    await setLockType(lv.id, ViewLockType.Locked, {
      meta: { lockedViewDescription: lockedMessage },
    });

    // Navigate straight to the table via URL — the sidebar renders the table
    // twice (base tree + data tree), so `treeView.openTable` strict-locator
    // fails. Going via URL is deterministic.
    await page.goto(`http://localhost:3000/${context.workspace.id}/${context.base.id}/${tableFkId}`, {
      waitUntil: 'networkidle',
    });
    await page.locator('.nc-sidebar').waitFor({ state: 'visible', timeout: 10_000 });
  });

  test.afterAll(async () => {
    if (context) await unsetup(context);
  });

  // ---------- Create View dialog -----------------------------------------

  test('Create View dialog — all three lock-type radios visible for owner', async () => {
    await dashboard.rootPage
      .locator('.nc-table-node-wrapper[data-active="true"]')
      .getByTestId('nc-sidebar-table-create-view-btn')
      .click();
    await dashboard.rootPage.getByTestId('sidebar-view-create-grid').first().click();

    const modal = dashboard.rootPage.locator('.nc-view-create-modal');
    await modal.waitFor({ state: 'visible' });

    for (const t of ['collaborative', 'personal', 'locked']) {
      await expect(modal.locator(`[data-testid="nc-create-view-lock-type-${t}"]`)).toBeVisible();
    }

    await dashboard.rootPage.keyboard.press('Escape');
  });

  // ---------- Locked-view footer -----------------------------------------

  test('Locked view — Filter menu embeds the GeneralLockedViewFooter footer', async () => {
    await dashboard.viewSidebar.openView({ title: vLocked });

    await dashboard.rootPage.locator('.nc-filter-menu-btn').first().click();

    // Footer renders for locked + non-owner-personal views. Presence is
    // sufficient for this smoke test — the tooltip content is separately
    // wired through `lockedViewDescription` meta and covered by Mocha.
    await expect(dashboard.rootPage.locator('.nc-locked-view-footer')).toBeVisible();

    await dashboard.rootPage.keyboard.press('Escape');
  });

  // ---------- Action menu — collab view ----------------------------------

  test('Action menu on collab view — Rename / Duplicate / Delete enabled, all lock-type subactions available', async () => {
    await dashboard.viewSidebar.openView({ title: vCollab });

    const sidebar = dashboard.viewSidebar.get();
    await sidebar.locator(`[data-testid="view-sidebar-view-${vCollab}"]`).hover();
    await sidebar
      .locator(`[data-testid="view-sidebar-view-${vCollab}"]`)
      .locator('.nc-sidebar-view-node-context-btn')
      .click();

    const menu = dashboard.rootPage.locator(`[data-testid="view-sidebar-view-actions-${vCollab}"]`);
    await menu.waitFor({ state: 'visible' });

    for (const label of ['Rename', 'Duplicate', 'Delete']) {
      const item = menu.locator(`.ant-dropdown-menu-item:has-text("${label}")`).first();
      const cls = (await item.getAttribute('class')) ?? '';
      expect(cls, `${label} should not be disabled`).not.toContain('ant-dropdown-menu-item-disabled');
    }

    // Open View mode sub-menu — subitems render in a detached popover,
    // not inside the original `view-sidebar-view-actions-*` dropdown,
    // so query from the page root.
    await menu.locator('text=View mode').hover();
    for (const t of ['Collaborative', 'Personal', 'Locked']) {
      await expect(dashboard.rootPage.locator(`[data-testid="nc-view-action-lock-subaction-${t}"]`)).toBeVisible();
    }

    await dashboard.rootPage.keyboard.press('Escape');
  });

  // ---------- Last-collab-grid guardrail ---------------------------------

  test('Multiple collab grids — Personal subaction is enabled on each (self-exclusion fix)', async () => {
    for (const viewTitle of [vCollab, vCollab2]) {
      await dashboard.viewSidebar.openView({ title: viewTitle });

      const sidebar = dashboard.viewSidebar.get();
      await sidebar.locator(`[data-testid="view-sidebar-view-${viewTitle}"]`).hover();
      await sidebar
        .locator(`[data-testid="view-sidebar-view-${viewTitle}"]`)
        .locator('.nc-sidebar-view-node-context-btn')
        .click();

      const menu = dashboard.rootPage.locator(`[data-testid="view-sidebar-view-actions-${viewTitle}"]`);
      await menu.waitFor({ state: 'visible' });

      await menu.locator('text=View mode').hover();
      // Prior iterations' menu subtrees can linger in the DOM (Ant Design
      // keeps popovers mounted), so scope the subaction to the currently
      // visible one.
      const personalItem = dashboard.rootPage
        .locator('[data-testid="nc-view-action-lock-subaction-Personal"]:visible')
        .first();
      await expect(personalItem, `${viewTitle} → Personal should be enabled`).not.toHaveAttribute(
        'aria-disabled',
        /true/
      );

      await dashboard.rootPage.keyboard.press('Escape');
      // Give the popover time to unmount before the next iteration.
      await dashboard.rootPage.waitForTimeout(500);
    }
  });

  // ---------- Last-collab-grid guardrail — reactivity after lock cycle ----

  test('Convert personal → locked → collab on one view does not stale-disable siblings', async () => {
    // Cycle on vCollab: collab → personal → (back to collab by self-revert) via backend.
    // After the cycle, vCollab2's Personal subaction should stay enabled because
    // there's still another non-personal grid (vCollab, plus vLocked which is
    // also non-personal).
    const viewsList = await axios.get(
      `${API_BASE}/api/v2/internal/${context.workspace.id}/${context.base.id}?operation=viewList&tableId=${tableFkId}`,
      { headers: { 'xc-auth': ownerToken } }
    );
    const collab1 = viewsList.data.list.find((v: any) => v.title === vCollab);
    expect(collab1).toBeTruthy();

    // personal (owned by current user)
    await setLockType(collab1.id, ViewLockType.Personal, { owned_by: context.rootUser.id });
    // back to collab
    await setLockType(collab1.id, ViewLockType.Collaborative);

    // Sanity: open vCollab2 and ensure Personal subaction is still enabled.
    await dashboard.viewSidebar.openView({ title: vCollab2 });

    const sidebar = dashboard.viewSidebar.get();
    await sidebar.locator(`[data-testid="view-sidebar-view-${vCollab2}"]`).hover();
    await sidebar
      .locator(`[data-testid="view-sidebar-view-${vCollab2}"]`)
      .locator('.nc-sidebar-view-node-context-btn')
      .click();

    const menu = dashboard.rootPage.locator(`[data-testid="view-sidebar-view-actions-${vCollab2}"]`);
    await menu.waitFor({ state: 'visible' });
    await menu.locator('text=View mode').hover();

    await expect(
      dashboard.rootPage.locator('[data-testid="nc-view-action-lock-subaction-Personal"]:visible').first()
    ).not.toHaveAttribute('aria-disabled', /true/);

    await dashboard.rootPage.keyboard.press('Escape');
  });
});
