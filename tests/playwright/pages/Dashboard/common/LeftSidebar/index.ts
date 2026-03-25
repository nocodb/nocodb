import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { isEE } from '../../../../setup/db';
import { NcContext } from '../../../../setup';
import { BaseListModalPage } from '../BaseListModal';
import { SidebarNavPage } from './SidebarNavPage';

/** Action types for the original MiniSidebar (v1) */
type MiniSidebarActionType =
  | 'ws'
  | 'base'
  | 'cmd-k'
  | 'cmd-l'
  | 'cmd-j'
  | 'teamAndSettings'
  | 'integration'
  | 'feeds'
  | 'notification'
  | 'userInfo';

export class LeftSidebarPage extends BasePage {
  readonly base: any;
  readonly dashboard: DashboardPage;
  readonly baseListModal: BaseListModalPage;
  readonly sidebarNav: SidebarNavPage;

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;
  readonly modal_baseList: Locator;

  /** Legacy MiniSidebar (v1) container */
  readonly miniSidebar: Locator;

  readonly active_base: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.baseListModal = new BaseListModalPage(dashboard);
    this.sidebarNav = new SidebarNavPage(dashboard.rootPage);

    this.btn_workspace = this.get().locator('.nc-workspace-menu');
    this.btn_newProject = this.rootPage.locator('[data-testid="nc-sidebar-create-base-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');
    this.modal_baseList = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');

    this.miniSidebar = this.dashboard.get().locator('[data-testid="nc-mini-sidebar"]');

    this.active_base = this.get().locator('.nc-treeview-container.nc-treeview-container-active-base');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns true if the legacy MiniSidebar (v1) is present in the DOM. */
  async isMiniSidebarVisible() {
    return (await this.miniSidebar.count()) > 0;
  }

  /** Returns true if MiniSidebarV2 is present in the DOM. Delegates to SidebarNavPage. */
  async isMiniSidebarV2Visible() {
    return this.sidebarNav.isMiniSidebarV2Visible();
  }

  /**
   * Returns the active mini-sidebar container (V2 preferred, falls back to V1).
   * Useful when code needs to work with both sidebar generations.
   */
  async getActiveMiniSidebar(): Promise<Locator> {
    if (await this.isMiniSidebarV2Visible()) return this.sidebarNav.miniSidebarV2;
    return this.miniSidebar;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 — logo / base list modal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Opens the base list by clicking the logo in MiniSidebarV2.
   * This navigates to the workspace home page (/{wsId}).
   * The logo element carries data-testid="nc-mini-sidebar-v2-logo".
   */
  async openBaseListModalViaV2(): Promise<void> {
    // If already on workspace home, no-op
    if (await this.baseListModal.isOpen()) return;

    const logo = this.sidebarNav.miniSidebarV2.getByTestId('nc-mini-sidebar-v2-logo');
    await logo.waitFor({ state: 'visible' });
    await logo.click();
    await this.baseListModal.waitForOpen();
    await this.rootPage.waitForTimeout(300);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Base list modal — works with both V1 and V2
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Opens or verifies the base list modal is open.
   * Tries V2 sidebar first, falls back to V1 workspace button.
   *
   * @param open - If true, opens the modal when it is not already visible.
   */
  async verifyBaseListOpen(open: boolean = false): Promise<boolean> {
    const isVisible = await this.baseListModal.isOpen();

    if (!isVisible && open) {
      if (await this.isMiniSidebarV2Visible()) {
        await this.openBaseListModalViaV2();
      } else {
        await this.miniSidebarActionClick({ type: 'ws' });
        await this.baseListModal.waitForOpen();
      }
    }

    await this.rootPage.waitForTimeout(300);
    return this.baseListModal.isOpen();
  }

  /**
   * Opens the base list — navigates to workspace home page (V2)
   * or opens the modal (V1 fallback).
   */
  async openBaseListModal(): Promise<void> {
    if (await this.baseListModal.isOpen()) return;

    if (await this.isMiniSidebarV2Visible()) {
      await this.openBaseListModalViaV2();
    } else {
      await this.miniSidebarActionClick({ type: 'ws' });
      await this.baseListModal.waitForOpen();
    }
  }

  /**
   * Closes the base list modal if open (legacy modal only).
   * For inline base list (new workspace page), this is a no-op.
   */
  async closeBaseListModal(): Promise<void> {
    await this.baseListModal.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 — navigation shortcuts (delegated to SidebarNavPage)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Opens the notification panel via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async openNotificationPanel(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.sidebarNav.clickMiniSidebarV2Tab('notification');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Common actions
  // ─────────────────────────────────────────────────────────────────────────

  /** Opens the create base menu using keyboard shortcut (Option/Alt + D). */
  async openCreateBaseMenuViaShortcut(): Promise<void> {
    await this.rootPage.keyboard.press('Alt+d');
    await this.rootPage.waitForTimeout(300);
  }

  async createProject({ title, context }: { title: string; context: NcContext }) {
    title = isEE() ? title : `nc-${context.workerId}-${title}`;
    await this.verifyBaseListOpen(true);

    await this.btn_newProject.click();

    if (isEE()) {
      await this.rootPage.getByTestId('nc-base-create-menu').waitFor();
      await this.rootPage.getByTestId('nc-base-create-menu').getByTestId('nc-menu-from-scratch').click();
    }

    await this.rootPage.locator('.ant-modal-content:has-text(" Create Base")').waitFor();
    await this.rootPage.locator('.ant-modal-content:has-text(" Create Base")').locator('input').fill(title);
    await this.rootPage
      .locator('.ant-modal-content:has-text(" Create Base")')
      .locator('button.ant-btn-primary')
      .click();

    await this.rootPage.locator('.nc-sidebar-header.nc-active-project').waitFor({ state: 'visible' });

    await this.verifyBaseListOpen(true);
  }

  /**
   * @deprecated Use sidebarNav.navigateToSettingsPage instead
   */
  async clickTeamAndSettings(): Promise<void> {
    // V2: team & settings is accessed via the 'settings' rail/dock tab
    if (await this.isMiniSidebarV2Visible()) {
      await this.sidebarNav.navigateToSettingsPage('ws-settings');
      return;
    }

    await this.miniSidebarActionClick({
      type: 'teamAndSettings',
      fallback: async () => {
        await this.btn_teamAndSettings.click();
      },
    });
  }

  async clickWorkspace(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.openBaseListModalViaV2();
      return;
    }
    await this.miniSidebarActionClick({
      type: 'ws',
      fallback: async () => {
        await this.btn_workspace.click();
      },
    });
  }

  async clickHome(): Promise<void> {}

  async getWorkspaceName(): Promise<string | null> {
    return this.get().locator('.nc-sidebar-header').getAttribute('data-workspace-title');
  }

  async verifyWorkspaceName({ title }: { title: string }): Promise<void> {
    return expect(await this.getWorkspaceName()).toContain(title);
  }

  async createWorkspace({ title }: { title: string }): Promise<void> {
    await this.openBaseListModal();

    // Click the + button in the HomeSidebar workspace header
    const createBtn = this.rootPage.getByTestId('nc-home-sidebar-create-ws');
    await createBtn.waitFor();
    await createBtn.click();

    const inputModal = this.rootPage.locator('div.ant-modal.active').last();
    await inputModal.waitFor();
    await inputModal.locator('input').clear();
    await inputModal.locator('input').fill(title);
    await inputModal.locator('button.ant-btn-primary').click();
  }

  async verifyWorkspaceCount({ count }: { count: number }): Promise<void> {
    await this.openBaseListModal();

    const workspaceNodes = this.rootPage.locator('[data-testid^="nc-home-sidebar-ws-"]');
    await expect(workspaceNodes).toHaveCount(count);
  }

  getWorkspaceNode(workspaceTitle: string): Locator {
    return this.rootPage.locator('[data-testid^="nc-home-sidebar-ws-"]').filter({
      hasText: workspaceTitle,
    });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-ws-node-active') ?? false;
  }

  async getWorkspaceList(): Promise<string[]> {
    const ws: string[] = [];

    await this.openBaseListModal();

    const items = this.rootPage.locator('[data-testid^="nc-home-sidebar-ws-"]');
    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const title = await items.nth(i).textContent();
      if (title) ws.push(title.trim());
    }

    return ws;
  }

  async openWorkspace(param: { title: string }): Promise<void> {
    await this.openBaseListModal();
    await this.rootPage.waitForTimeout(300);

    const workspaceNode = this.getWorkspaceNode(param.title);
    await workspaceNode.click();

    await this.rootPage.waitForTimeout(1000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy MiniSidebar (v1) helpers — kept for backward compatibility
  // ─────────────────────────────────────────────────────────────────────────

  async getMiniSidebarActionLocator({ type }: { type: MiniSidebarActionType }): Promise<Locator | undefined> {
    await this.miniSidebar.waitFor();

    const locators: Record<MiniSidebarActionType, Locator> = {
      ws: this.miniSidebar.getByTestId('nc-workspace-menu'),
      base: this.miniSidebar.getByTestId('nc-sidebar-project-btn'),
      'cmd-k': this.miniSidebar.getByTestId('nc-sidebar-cmd-k-btn'),
      'cmd-l': this.miniSidebar.getByTestId('nc-sidebar-cmd-l-btn'),
      'cmd-j': this.miniSidebar.getByTestId('nc-sidebar-cmd-j-btn'),
      teamAndSettings: this.miniSidebar.getByTestId('nc-sidebar-team-settings-btn'),
      integration: this.miniSidebar.getByTestId('nc-sidebar-integrations-btn'),
      feeds: this.miniSidebar.getByTestId('nc-sidebar-product-feed'),
      notification: this.miniSidebar.getByTestId('nc-sidebar-notification-btn'),
      userInfo: this.miniSidebar.getByTestId('nc-sidebar-userinfo'),
    };

    return locators[type];
  }

  async miniSidebarActionClick({
    type,
    fallback,
  }: {
    type: MiniSidebarActionType;
    fallback?: () => Promise<void>;
  }): Promise<boolean | void> {
    if (!(await this.isMiniSidebarVisible())) {
      if (fallback) {
        await fallback();
      }

      return false;
    }

    await this.miniSidebar.waitFor();

    const miniSidebarActionLocator = await this.getMiniSidebarActionLocator({ type });

    if (miniSidebarActionLocator) {
      await miniSidebarActionLocator.click();
      await this.rootPage.waitForTimeout(500);
    }
  }

  /**
   * Verifies the visibility of mini sidebar actions.
   *
   * When MiniSidebarV2 is active, V1 action types are mapped to their V2
   * equivalents where possible. Types with no V2 equivalent are skipped.
   *
   * V1 → V2 mapping:
   *   teamAndSettings → settings tab ([data-panel="settings"])
   *   notification    → notification tab ([data-panel="notification"])
   *   userInfo        → [data-testid="nc-sidebar-userinfo"] (still rendered via DashboardSidebarUserInfo)
   *   cmd-k, cmd-l, cmd-j, integration, feeds → no V2 equivalent; assertion skipped
   */
  async verifyMiniSidebarActions({
    types = [],
    isVisible = true,
  }: {
    types: MiniSidebarActionType[];
    isVisible: boolean;
  }): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      const v2Mapping: Partial<Record<MiniSidebarActionType, string>> = {
        teamAndSettings: 'settings',
        notification: 'notification',
      };

      for (const type of types) {
        const v2Key = v2Mapping[type];

        if (v2Key === 'userInfo') {
          const locator = this.rootPage.getByTestId('nc-sidebar-userinfo');
          if (isVisible) await expect(locator).toBeVisible();
          else await expect(locator).not.toBeVisible();
        } else if (v2Key) {
          const locator = this.sidebarNav.getMiniSidebarV2TabLocator(v2Key as any);
          if (isVisible) await expect(locator).toBeVisible();
          else await expect(locator).not.toBeVisible();
        }
        // types with no V2 equivalent (cmd-k, cmd-l, cmd-j, integration, feeds) are skipped
      }

      return;
    }

    // V1 path
    for (const type of types) {
      const locator = await this.getMiniSidebarActionLocator({ type });

      if (isVisible) await expect(locator).toBeVisible();
      else await expect(locator).not.toBeVisible();
    }
  }
}
