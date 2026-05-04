import { expect, Page, test } from '@playwright/test';
import setup, { NcContext, unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { WorkspacePage } from '../../pages/WorkspacePage';

/**
 * Org-user invite picker — verifies the dropdown that surfaces existing org
 * members as suggestions inside the workspace/base invite dialog.
 *
 * The picker is **admin-only**: only org admins (cloud-org-level-owner) and
 * on-prem super admins can call `GET /api/v2/orgs/:orgId/users/invitable`.
 * The frontend mirrors that gate so a non-admin user never even attempts the
 * call. These tests cover both:
 *   - admin happy path (route is stubbed so we exercise UI behaviour without
 *     depending on which backend mode is running)
 *   - non-admin negative path (no request fired, picker stays hidden even
 *     when the user clicks the email input)
 */

type StubUser = { id: string; email: string; display_name?: string };

const STUB_USERS: StubUser[] = [
  { id: 'usr_alice', email: 'alice.invite-picker@nocodb.com', display_name: 'Alice Picker' },
  { id: 'usr_bob', email: 'bob.invite-picker@nocodb.com', display_name: 'Bob Picker' },
  { id: 'usr_carol', email: 'carol.invite-picker@nocodb.com', display_name: 'Carol Picker' },
];

async function stubInvitableUsers(
  page: Page,
  users: StubUser[],
  capture: { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number }
) {
  await page.route('**/api/v2/orgs/*/users/invitable*', async route => {
    const url = new URL(route.request().url());
    capture.excludeWorkspaceId = url.searchParams.get('excludeWorkspaceId') || undefined;
    capture.excludeBaseId = url.searchParams.get('excludeBaseId') || undefined;
    capture.hits += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(users),
    });
  });
}

test.describe('Org-user invite picker — admin', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    // Sign in as the seeded super admin (`user@nocodb.com`). The picker is
    // admin-only on the frontend, so a regular user wouldn't even fire the
    // backend call; the admin variant is the happy path.
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    dashboard = new DashboardPage(page, context.base);
    workspacePage = new WorkspacePage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  const openWorkspaceInviteDlg = async () => {
    await dashboard.leftSidebar.sidebarNav.navigateToSettingsPage('ws-collaborators');
    await workspacePage.collaboration.waitFor({ state: 'visible' });
    await workspacePage.collaboration.get().getByTestId('nc-add-member-btn').click();
    const inviteModal = dashboard.rootPage.locator('.nc-invite-dlg');
    await inviteModal.waitFor({ state: 'visible' });
    return inviteModal;
  };

  test('hidden on dialog open until the user interacts with the input', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');
    const input = inviteModal.locator('input[id="email"]');

    // Backend was hit on open (data is preloaded), but the dropdown should not
    // appear until the user explicitly engages with the email input.
    await expect.poll(() => capture.hits, { timeout: 5000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await expect(picker).toBeHidden();

    // First user click surfaces the dropdown.
    await input.click();
    await expect(picker).toBeVisible();
  });

  test('shows matching org users and forwards excludeWorkspaceId', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    // The backend request fires when the dialog opens (`watch(dialogShow)`).
    await expect.poll(() => capture.hits, { timeout: 5000 }).toBeGreaterThan(0);
    expect(capture.excludeWorkspaceId).toBe(context.workspace.id);
    expect(capture.excludeBaseId).toBeUndefined();

    // Focus surfaces the dropdown — no typing required, all suggestions visible.
    await input.click();
    await expect(picker).toBeVisible();

    for (const u of STUB_USERS) {
      await expect(picker.locator(`[data-testid="nc-invite-org-user-${u.email}"]`)).toBeVisible();
    }
  });

  test('filters suggestions by typed query (email or display name)', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    await input.click();
    await expect(picker).toBeVisible();

    // Match by display name substring — only Alice should remain.
    await input.fill('alice');
    await expect(picker.locator('[data-testid^="nc-invite-org-user-"]')).toHaveCount(1);
    await expect(picker.locator(`[data-testid="nc-invite-org-user-${STUB_USERS[0].email}"]`)).toBeVisible();

    // Match by email substring — Carol.
    await input.fill('carol.invite');
    await expect(picker.locator('[data-testid^="nc-invite-org-user-"]')).toHaveCount(1);
    await expect(picker.locator(`[data-testid="nc-invite-org-user-${STUB_USERS[2].email}"]`)).toBeVisible();

    // No match — picker hides because the filtered list is empty.
    await input.fill('zzz-no-match');
    await expect(picker).toBeHidden();
  });

  test('click adds email as a chip and removes user from further suggestions', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    await input.click();
    await expect(picker).toBeVisible();

    await picker.locator(`[data-testid="nc-invite-org-user-${STUB_USERS[1].email}"]`).click();

    // Chip for Bob should now be rendered inside the email chip container.
    await expect(inviteModal.getByText(STUB_USERS[1].email, { exact: true })).toBeVisible();

    // Focus back on the input — Bob should no longer appear (already selected).
    await input.click();
    await expect(picker).toBeVisible();
    await expect(picker.locator(`[data-testid="nc-invite-org-user-${STUB_USERS[1].email}"]`)).toHaveCount(0);
    await expect(picker.locator(`[data-testid="nc-invite-org-user-${STUB_USERS[0].email}"]`)).toBeVisible();
  });

  test('keyboard: ArrowDown + Enter selects the highlighted suggestion', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    await input.click();
    await expect(picker).toBeVisible();

    // First item is highlighted by default; ArrowDown moves to the second.
    await input.press('ArrowDown');
    await input.press('Enter');

    await expect(inviteModal.getByText(STUB_USERS[1].email, { exact: true })).toBeVisible();
  });

  test('end-to-end: pick org user, set role, submit, verify invite landed', async ({ page }) => {
    // Real seeded test user — exists in the backend, so the invite call below
    // hits a real persisted account rather than auto-creating cruft.
    const realUser = {
      id: 'usr_test_seeded_1',
      email: 'user-1@nocodb.com',
      display_name: 'User One',
    };

    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, [realUser], capture);

    const inviteModal = await openWorkspaceInviteDlg();
    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    // Pick user-1 from the dropdown.
    await input.click();
    await expect(picker).toBeVisible();
    await picker.locator(`[data-testid="nc-invite-org-user-${realUser.email}"]`).click();
    await expect(inviteModal.getByText(realUser.email, { exact: true })).toBeVisible();

    // Set role to viewer (default is no-access, which can't be invited).
    await inviteModal.locator('.nc-roles-selector').first().click();
    const roleMenu = page.locator('.nc-role-selector-dropdown:visible');
    await roleMenu.locator('.nc-role-select-workspace-level-viewer:visible').first().click();

    // allow the invite button to flip enabled
    await page.waitForTimeout(300);

    // Submit — real backend call, not stubbed.
    await inviteModal.locator('.nc-invite-btn').click();

    // Toast confirms the backend accepted the invite.
    await expect(page.locator('.ant-message').getByText(/Invitation sent successfully/i)).toBeVisible();

    // Dialog closes, and the invitee shows up in the workspace members list.
    await inviteModal.waitFor({ state: 'hidden' });
    await expect(page.getByText(realUser.email).first()).toBeVisible();
  });
});

test.describe('Org-user invite picker — non-admin', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    // Default setup signs in as `user-${parallelId}@nocodb.com`, which is a
    // regular workspace user — *not* an org admin. The frontend gate should
    // suppress the picker entirely for them.
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    workspacePage = new WorkspacePage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('non-admin user does not see picker even after clicking the input', async ({ page }) => {
    const capture = { hits: 0 } as { excludeWorkspaceId?: string; excludeBaseId?: string; hits: number };
    await stubInvitableUsers(page, STUB_USERS, capture);

    await dashboard.leftSidebar.sidebarNav.navigateToSettingsPage('ws-collaborators');
    await workspacePage.collaboration.waitFor({ state: 'visible' });
    await workspacePage.collaboration.get().getByTestId('nc-add-member-btn').click();

    const inviteModal = dashboard.rootPage.locator('.nc-invite-dlg');
    await inviteModal.waitFor({ state: 'visible' });

    const input = inviteModal.locator('input[id="email"]');
    const picker = inviteModal.locator('[data-testid="nc-invite-org-user-picker"]');

    // Click the input — admin would surface the picker, non-admin should not.
    await input.click();
    await page.waitForTimeout(1000);

    // Frontend gate prevents the call entirely; route stub should never fire.
    expect(capture.hits).toBe(0);
    await expect(picker).toBeHidden();
  });
});
