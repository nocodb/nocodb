import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { isEE } from '../../../../setup/db';
import { NcContext } from '../../../../setup';
import { BaseListModalPage } from '../BaseListModal';

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

/**
 * Tab / panel keys for MiniSidebarV2 (new-sidebar-2 branch).
 *
 * Rail main items  : 'data', 'automations', 'settings'
 * Rail bottom items: 'theme', 'support'
 * Dock main items  : 'data', 'automations', 'settings'
 * Dock bottom items: 'support'
 * Both             : 'notification' (dropdown)
 */
type MiniSidebarV2TabType =
  | 'data'
  | 'automations'
  | 'notification'
  | 'theme'
  | 'agents'
  | 'settings'
  | 'support'
  | 'bookmarks'
  | 'more';

export class LeftSidebarPage extends BasePage {
  readonly base: any;
  readonly dashboard: DashboardPage;
  readonly baseListModal: BaseListModalPage;

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;
  readonly modal_baseList: Locator;

  /** Legacy MiniSidebar (v1) container */
  readonly miniSidebar: Locator;

  /**
   * MiniSidebarV2 container — present on the new-sidebar-2 branch.
   * Can be in rail mode ([data-testid="nc-mini-sidebar-v2-rail"]) or
   * dock mode ([data-testid="nc-mini-sidebar-v2-dock"]) depending on user setting.
   */
  readonly miniSidebarV2: Locator;

  readonly active_base: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.baseListModal = new BaseListModalPage(dashboard);

    this.btn_workspace = this.get().locator('.nc-workspace-menu');
    this.btn_newProject = this.rootPage.locator('[data-testid="nc-sidebar-create-base-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');
    this.modal_baseList = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');

    this.miniSidebar = this.dashboard.get().locator('[data-testid="nc-mini-sidebar"]');
    this.miniSidebarV2 = this.dashboard.get().locator('[data-testid="nc-mini-sidebar-v2"]');

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

  /** Returns true if MiniSidebarV2 is present in the DOM. */
  async isMiniSidebarV2Visible() {
    return (await this.miniSidebarV2.count()) > 0;
  }

  /**
   * Returns the active mini-sidebar container (V2 preferred, falls back to V1).
   * Useful when code needs to work with both sidebar generations.
   */
  async getActiveMiniSidebar(): Promise<Locator> {
    if (await this.isMiniSidebarV2Visible()) return this.miniSidebarV2;
    return this.miniSidebar;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 — navigation tab helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the locator for a tab/panel item inside MiniSidebarV2.
   * Items are identified by their `data-panel` attribute which is set via
   * the `panelKey` prop on `RailItem` / `DockItem`.
   */
  getMiniSidebarV2TabLocator(tab: MiniSidebarV2TabType): Locator {
    return this.miniSidebarV2.locator(`[data-panel="${tab}"]`);
  }

  /**
   * Clicks a tab in MiniSidebarV2 and waits for the navigation transition.
   *
   * @param tab - One of the MiniSidebarV2TabType keys ('data', 'automations', 'settings', …)
   */
  async clickMiniSidebarV2Tab(tab: MiniSidebarV2TabType): Promise<void> {
    await this.miniSidebarV2.waitFor({ state: 'visible' });
    const tabLocator = this.getMiniSidebarV2TabLocator(tab);
    await tabLocator.waitFor({ state: 'visible' });
    await tabLocator.click();
    await this.rootPage.waitForTimeout(500);
  }

  /**
   * Asserts that the given tab is currently active (has the `active` class).
   */
  async verifyMiniSidebarV2ActiveTab(tab: MiniSidebarV2TabType): Promise<void> {
    const tabLocator = this.getMiniSidebarV2TabLocator(tab);
    await expect(tabLocator).toHaveClass(/active/);
  }

  /**
   * Asserts that the given tab is NOT active.
   */
  async verifyMiniSidebarV2InactiveTab(tab: MiniSidebarV2TabType): Promise<void> {
    const tabLocator = this.getMiniSidebarV2TabLocator(tab);
    await expect(tabLocator).not.toHaveClass(/active/);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 — logo / base list modal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Opens the base list modal by clicking the logo in MiniSidebarV2.
   * The logo element carries data-testid="nc-mini-sidebar-v2-logo".
   */
  async openBaseListModalViaV2(): Promise<void> {
    if (await this.modal_baseList.isVisible()) return;

    const logo = this.miniSidebarV2.getByTestId('nc-mini-sidebar-v2-logo');
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
    const isModalOpen = await this.modal_baseList.isVisible();

    if (!isModalOpen && open) {
      if (await this.isMiniSidebarV2Visible()) {
        await this.openBaseListModalViaV2();
      } else {
        await this.miniSidebarActionClick({ type: 'ws' });
        await this.baseListModal.waitForOpen();
      }
    }

    await this.rootPage.waitForTimeout(300);
    return this.modal_baseList.isVisible();
  }

  /** Opens the base list modal (V2 first, V1 fallback). */
  async openBaseListModal(): Promise<void> {
    if (await this.modal_baseList.isVisible()) return;

    if (await this.isMiniSidebarV2Visible()) {
      await this.openBaseListModalViaV2();
    } else {
      await this.miniSidebarActionClick({ type: 'ws' });
      await this.baseListModal.waitForOpen();
    }
  }

  /** Closes the base list modal if open. */
  async closeBaseListModal(): Promise<void> {
    await this.baseListModal.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 — navigation shortcuts
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Navigates to the Data section (tables/views/scripts) via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToDataTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('data');
    }
  }

  /**
   * Navigates to the Automation section via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToAutomationTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('automations');
    }
  }

  /**
   * Navigates to the Settings / Base Settings section via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToSettingsTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('settings');
    }
  }

  /**
   * Opens the notification panel via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async openNotificationPanel(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('notification');
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

  async clickTeamAndSettings(): Promise<void> {
    // V2: team & settings is accessed via the 'settings' rail/dock tab
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('settings');
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

    const newWorkspaceBtn = this.modal_baseList.locator('button:has-text("New Workspace")');
    await newWorkspaceBtn.waitFor();
    await newWorkspaceBtn.click();

    const inputModal = this.rootPage.locator('div.ant-modal.active').last();
    await inputModal.waitFor();
    await inputModal.locator('input').clear();
    await inputModal.locator('input').fill(title);
    await inputModal.locator('button.ant-btn-primary').click();
  }

  async verifyWorkspaceCount({ count }: { count: number }): Promise<void> {
    await this.openBaseListModal();

    const workspaceNodes = this.modal_baseList.locator('.nc-workspace-node');
    await expect(workspaceNodes).toHaveCount(count);

    await this.closeBaseListModal();
  }

  getWorkspaceNode(workspaceTitle: string): Locator {
    return this.modal_baseList.locator('.nc-workspace-node').filter({
      has: this.rootPage.locator('.nc-workspace-node-title', { hasText: workspaceTitle }),
    });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-selected-workspace-node') ?? false;
  }

  async getWorkspaceList(): Promise<string[]> {
    const ws: string[] = [];

    await this.openBaseListModal();

    const titles = this.modal_baseList.locator('.nc-workspace-node-title');
    const count = await titles.count();

    for (let i = 0; i < count; i++) {
      const title = await titles.nth(i).textContent();
      if (title) ws.push(title.trim());
    }

    await this.closeBaseListModal();

    return ws;
  }

  async openWorkspace(param: { title: string }): Promise<void> {
    await this.openBaseListModal();
    await this.rootPage.waitForTimeout(300);

    if (await this.isWorkspaceSelected(param.title)) {
      await this.closeBaseListModal();
      return;
    }

    const workspaceNode = this.getWorkspaceNode(param.title);
    await workspaceNode.locator('.nc-workspace-node-navigate-icon').click();

    await this.rootPage.waitForTimeout(2000);

    await this.closeBaseListModal();
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
      const v2Mapping: Partial<Record<MiniSidebarActionType, MiniSidebarV2TabType | 'userInfo'>> = {
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
          const locator = this.getMiniSidebarV2TabLocator(v2Key as MiniSidebarV2TabType);
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
