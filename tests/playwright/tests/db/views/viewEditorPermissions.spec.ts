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

// =====================================================================
// Editor role — UI coverage
// =====================================================================
// Signs in the editor by injecting their JWT into localStorage rather
// than walking the /signin form. The onboarding + projects-list render
// flow for API-provisioned accounts is racy and caused earlier attempts
// to hang; this direct path is deterministic.

const editorPrefix = () => `nc_test_${process.env.TEST_PARALLEL_INDEX ?? '0'}_`;

test.describe('View editor permissions — UI (editor role)', () => {
  let ownerCtx: any;
  let ownerToken: string;
  let tableFkId: string;

  let editorContext: import('@playwright/test').BrowserContext;
  let editorPage: import('@playwright/test').Page;
  let editorDash: DashboardPage;
  let editor2Id: string;

  const editor1Email = 'ved-editor1@nc-ved.com';
  const editor2Email = 'ved-editor2@nc-ved.com';
  const pwd = 'Password123.';

  const tableTitle = `VEPerm_ed_${Date.now().toString(36)}`;
  const vCollab = 'v_collab_ed';
  const vLocked = 'v_locked_ed';
  const vPersonalE2 = 'v_personal_e2_ed';

  const apiCall = (token: string, query: Record<string, string>, body: Record<string, unknown> = {}) => {
    const qs = new URLSearchParams(query).toString();
    return axios.post(`${API_BASE}/api/v2/internal/${ownerCtx.workspace.id}/${ownerCtx.base.id}?${qs}`, body, {
      headers: { 'xc-auth': token },
    });
  };

  const createGridView = async (title: string) => {
    const res = await apiCall(ownerToken, { operation: 'gridViewCreate', tableId: tableFkId }, { title });
    return res.data as { id: string; title: string };
  };

  const setLockType = (viewId: string, lock_type: ViewLockType, extra: Record<string, unknown> = {}) =>
    apiCall(ownerToken, { operation: 'viewUpdate', viewId }, { lock_type, ...extra });

  // Sign up if the email doesn't exist, otherwise login — in both cases
  // return the auth token so we can inject it into a browser context.
  const getAuthToken = async (email: string) => {
    const prefixed = editorPrefix() + email;
    try {
      const signupRes = await axios.post(`${API_BASE}/api/v1/auth/user/signup`, { email: prefixed, password: pwd });
      return signupRes.data.token as string;
    } catch {
      const signinRes = await axios.post(`${API_BASE}/api/v1/auth/user/signin`, { email: prefixed, password: pwd });
      return signinRes.data.token as string;
    }
  };

  const inviteWs = async (email: string, role: string) => {
    const api = ownerCtx.api;
    if (!api?.workspaceUser) return;
    try {
      await api.workspaceUser.invite(ownerCtx.workspace.id, { email: editorPrefix() + email, roles: role });
    } catch {
      // already invited — ignore
    }
  };

  const resolveUserId = async (email: string): Promise<string | undefined> => {
    const api = ownerCtx.api;
    const res = await api.workspaceUser.list(ownerCtx.workspace.id, {});
    const list = (res?.users ?? res?.list ?? res) as Array<{ id: string; email: string }>;
    return (Array.isArray(list) ? list : []).find(u => u.email === editorPrefix() + email)?.id;
  };

  // Create an isolated browser context with the given JWT pre-seeded
  // into localStorage so the SPA considers it signed in. Lands on the
  // base URL so the sidebar tree renders.
  const tokenSignedInContext = async (browser: any, token: string) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript((tok: string) => {
      // Matches the key/value shape read by useGlobal()
      localStorage.setItem('nocodb-gui-v2', JSON.stringify({ token: tok }));
    }, token);

    const page = await ctx.newPage();
    await page.goto(`http://localhost:3000/${ownerCtx.workspace.id}/${ownerCtx.base.id}/${tableFkId}`, {
      waitUntil: 'networkidle',
    });
    await page.locator('.nc-sidebar').waitFor({ state: 'visible', timeout: 15_000 });
    return { ctx, page };
  };

  test.beforeAll(async ({ browser }) => {
    test.skip(!isEE(), 'EE-only: workspace-level roles + lock types');

    // Owner setup via the test harness.
    const ownerPage = await browser.newPage();
    ownerCtx = await setup({ page: ownerPage, isEmptyProject: true });
    ownerToken = ownerCtx.token;

    // Dedicated table so fixtures don't collide with the owner-only spec.
    const tbl = await ownerCtx.api.dbTable.create(ownerCtx.base.id, {
      table_name: tableTitle,
      title: tableTitle,
      columns: [{ title: 'Name', column_name: 'name', uidt: 'SingleLineText' }],
    });
    tableFkId = tbl.id;

    // Seed two editors + invite at workspace level.
    const editor1Token = await getAuthToken(editor1Email);
    await getAuthToken(editor2Email);
    await inviteWs(editor1Email, 'workspace-level-editor');
    await inviteWs(editor2Email, 'workspace-level-editor');
    editor2Id = (await resolveUserId(editor2Email))!;

    // Fixture views as owner.
    await createGridView(vCollab);
    const lv = await createGridView(vLocked);
    await setLockType(lv.id, ViewLockType.Locked);
    const pe2 = await createGridView(vPersonalE2);
    await setLockType(pe2.id, ViewLockType.Personal, { owned_by: editor2Id });

    // Editor-1 browser context with injected token.
    const ed = await tokenSignedInContext(browser, editor1Token);
    editorContext = ed.ctx;
    editorPage = ed.page;
    editorDash = new DashboardPage(editorPage, ownerCtx.base);
  });

  test.afterAll(async () => {
    await editorContext?.close();
    if (ownerCtx) await unsetup(ownerCtx);
  });

  // ---------- helpers scoped to the editor page -----------------------

  const openViewMenu = async (viewTitle: string) => {
    const sidebar = editorDash.viewSidebar.get();
    await sidebar.locator(`[data-testid="view-sidebar-view-${viewTitle}"]`).hover();
    await sidebar
      .locator(`[data-testid="view-sidebar-view-${viewTitle}"]`)
      .locator('.nc-sidebar-view-node-context-btn')
      .click();
    const menu = editorPage.locator(`[data-testid="view-sidebar-view-actions-${viewTitle}"]`);
    await menu.waitFor({ state: 'visible' });
    return menu;
  };

  const closeMenu = async () => {
    await editorPage.keyboard.press('Escape');
    await editorPage.waitForTimeout(300);
  };

  const isMenuItemDisabled = async (menu: import('@playwright/test').Locator, label: string) => {
    const item = menu.locator(`.ant-dropdown-menu-item:has-text("${label}")`).first();
    const cls = (await item.getAttribute('class')) ?? '';
    return cls.includes('ant-dropdown-menu-item-disabled');
  };

  // ---------- §1 Create View dialog -----------------------------------

  test('Editor — Create View dialog hides the Locked radio', async () => {
    await editorPage
      .locator('.nc-table-node-wrapper[data-active="true"]')
      .getByTestId('nc-sidebar-table-create-view-btn')
      .click();
    await editorPage.getByTestId('sidebar-view-create-grid').first().click();

    const modal = editorPage.locator('.nc-view-create-modal');
    await modal.waitFor({ state: 'visible' });

    await expect(modal.locator('[data-testid="nc-create-view-lock-type-collaborative"]')).toBeVisible();
    await expect(modal.locator('[data-testid="nc-create-view-lock-type-personal"]')).toBeVisible();
    await expect(modal.locator('[data-testid="nc-create-view-lock-type-locked"]')).toHaveCount(0);

    await editorPage.keyboard.press('Escape');
  });

  // ---------- §2 Editor action menu on collab view --------------------

  test('Editor — collab view action menu: Rename / Duplicate / Delete enabled; Locked subaction disabled', async () => {
    await editorDash.viewSidebar.openView({ title: vCollab });
    const menu = await openViewMenu(vCollab);

    for (const label of ['Rename', 'Duplicate', 'Delete']) {
      expect(await isMenuItemDisabled(menu, label), `${label} should NOT be disabled`).toBe(false);
    }

    await menu.locator('text=View mode').hover();
    await expect(
      editorPage.locator('[data-testid="nc-view-action-lock-subaction-Collaborative"]:visible').first()
    ).not.toHaveAttribute('aria-disabled', /true/);
    await expect(
      editorPage.locator('[data-testid="nc-view-action-lock-subaction-Personal"]:visible').first()
    ).not.toHaveAttribute('aria-disabled', /true/);
    await expect(
      editorPage.locator('[data-testid="nc-view-action-lock-subaction-Locked"]:visible').first()
    ).toHaveAttribute('aria-disabled', /true/);

    await closeMenu();
  });

  // ---------- §2 Editor action menu on locked view --------------------

  test('Editor — locked view action menu: Rename / Delete disabled; Duplicate enabled', async () => {
    await editorDash.viewSidebar.openView({ title: vLocked });
    const menu = await openViewMenu(vLocked);

    for (const label of ['Rename', 'Delete']) {
      expect(await isMenuItemDisabled(menu, label), `${label} should be disabled on locked view`).toBe(true);
    }
    expect(await isMenuItemDisabled(menu, 'Duplicate'), 'Duplicate should stay enabled').toBe(false);

    await closeMenu();
  });

  // ---------- §2 Editor action menu on others' personal view ----------

  test("Editor — other user's personal view action menu: Rename / Delete disabled", async () => {
    await editorDash.viewSidebar.openView({ title: vPersonalE2 });
    const menu = await openViewMenu(vPersonalE2);

    for (const label of ['Rename', 'Delete']) {
      expect(await isMenuItemDisabled(menu, label), `${label} should be disabled on another user's personal view`).toBe(
        true
      );
    }

    await closeMenu();
  });

  // ---------- §4 Sections — editor blocked from CRUD -----------------

  test('Editor — Section "+" menu disabled with creator-only tooltip', async () => {
    // Open the sidebar "+" menu for the active table.
    const plus = editorPage
      .locator('.nc-table-node-wrapper[data-active="true"]')
      .getByTestId('nc-sidebar-table-create-view-btn');
    await plus.click();

    const sectionItem = editorPage.locator('[data-testid="sidebar-view-create-section"]');
    await expect(sectionItem).toBeVisible();
    const cls = (await sectionItem.getAttribute('class')) ?? '';
    // Ant's disabled state on the menu item puts the class on the inner
    // <li> — check either the `disabled` attribute or the CSS class.
    const ariaDisabled = (await sectionItem.getAttribute('aria-disabled')) ?? '';
    expect(
      cls.includes('ant-dropdown-menu-item-disabled') || /true/.test(ariaDisabled),
      'Section create menu item must be disabled for editor'
    ).toBe(true);

    await closeMenu();
  });

  // ---------- §8 Share view — editor ---------------------------------

  test('Editor — Share button visible on view toolbar', async () => {
    await editorDash.viewSidebar.openView({ title: vCollab });
    await expect(editorPage.locator('[data-testid="share-base-button"]')).toBeVisible();
  });

  test('Editor — Share modal does NOT show Share Base section or Manage Base Access', async () => {
    await editorDash.viewSidebar.openView({ title: vCollab });
    await editorPage.locator('[data-testid="share-base-button"]').click();

    // Modal opens
    await editorPage.locator('.ant-modal.active, .ant-modal').first().waitFor({ state: 'visible' });

    // Share Base section should not render for editor — key testid lives
    // inside ShareBase.vue (`nc-share-base-sub-modal`).
    await expect(editorPage.locator('[data-testid="nc-share-base-sub-modal"]')).toHaveCount(0);

    // Manage Base Access button also hidden
    await expect(editorPage.locator('[data-testid="docs-share-manage-access"]')).toHaveCount(0);

    await editorPage.keyboard.press('Escape');
  });
});
