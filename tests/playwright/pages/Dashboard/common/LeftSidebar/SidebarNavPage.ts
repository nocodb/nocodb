import { expect, Locator, Page } from '@playwright/test';
import BasePage from '../../../Base';

/** Base settings menu items (BaseSettingsMenu.vue) */
export type BaseSettingsMenuItem =
  | 'collaborator'
  | 'permissions'
  | 'mcp'
  | 'syncs'
  | 'snapshots'
  | 'data-source'
  | 'settings';

/** Workspace settings menu items (WsSettingsMenu.vue) */
export type WsSettingsMenuItem =
  | 'ws-collaborators'
  | 'ws-teams'
  | 'ws-integrations'
  | 'ws-billing'
  | 'ws-audits'
  | 'ws-sso'
  | 'ws-settings';

/** Any settings menu item */
export type SettingsMenuItem = BaseSettingsMenuItem | WsSettingsMenuItem;

/**
 * Tab / panel keys for MiniSidebarV2.
 */
type MiniSidebarV2TabType =
  | 'data'
  | 'workflows'
  | 'chat'
  | 'notification'
  | 'theme'
  | 'agents'
  | 'settings'
  | 'support';

export class SidebarNavPage extends BasePage {
  readonly sidebar: Locator;
  readonly miniSidebarV2: Locator;

  constructor(rootPage: Page) {
    super(rootPage);
    this.sidebar = rootPage.locator('.nc-sidebar');
    this.miniSidebarV2 = rootPage.locator('[data-testid="nc-mini-sidebar-v2"]');
  }

  get() {
    return this.sidebar;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MiniSidebarV2 helpers
  // ─────────────────────────────────────────────────────────────────────────

  async isMiniSidebarV2Visible(): Promise<boolean> {
    return (await this.miniSidebarV2.count()) > 0;
  }

  getMiniSidebarV2TabLocator(tab: MiniSidebarV2TabType): Locator {
    return this.miniSidebarV2.locator(`[data-panel="${tab}"]`);
  }

  async clickMiniSidebarV2Tab(tab: MiniSidebarV2TabType): Promise<void> {
    await this.miniSidebarV2.waitFor({ state: 'visible' });
    const tabLocator = this.getMiniSidebarV2TabLocator(tab);
    await tabLocator.waitFor({ state: 'visible' });

    // For panel tabs, skip clicking if already active
    const classList = await tabLocator.getAttribute('class');
    if (classList?.includes('active')) return;

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
  // Tab navigation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Navigates to the Data section (tables/views/scripts) via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToDataTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('data');
      await this.rootPage.waitForLoadState('networkidle');
    }
  }

  /**
   * Navigates to the Data tab (documents now live alongside tables/dashboards).
   * @deprecated Docs tab removed — delegates to navigateToDataTab().
   */
  async navigateToDocsTab(): Promise<void> {
    await this.navigateToDataTab();
  }

  /**
   * Navigates to the Automation section via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToWorkflowsTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('workflows');
      await this.rootPage.waitForLoadState('networkidle');
    }
  }

  /**
   * Navigates to the Settings / Base Settings section via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToSettingsTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('settings');
      await this.rootPage.waitForLoadState('networkidle');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings menu items
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the locator for a settings menu item by its key.
   */
  getSettingsMenuItemLocator(item: SettingsMenuItem): Locator {
    const sidebar = this.get();

    // Workspace items start with 'ws-'
    if (item.startsWith('ws-')) {
      const wsTabMap: Record<string, string> = {
        'ws-collaborators': 'Members',
        'ws-teams': 'Teams',
        'ws-integrations': 'Integrations',
        'ws-billing': 'Billing',
        'ws-audits': 'Audits',
        'ws-sso': 'SSO',
        'ws-settings': 'Settings',
      };

      const tabLabel = wsTabMap[item];

      // Match either the sidebar settings menu item OR the workspace home tab
      return sidebar.getByTestId(item).or(this.rootPage.locator('.nc-ws-view-tabs .tab-title', { hasText: tabLabel }));
    }

    // Base settings items
    return sidebar.getByTestId(`base-${item}`);
  }

  /**
   * Navigates to a specific settings page.
   *
   * For base settings: clicks the settings tab then the target menu item.
   * For workspace settings (ws-* items): navigates via the workspace home
   * page tabs (Members, Teams, Integrations, etc.) when the HomeSidebar
   * is active, otherwise falls back to the settings sidebar menu.
   *
   * @example
   *   await settings.navigateToSettingsPage('collaborator');       // Base members
   *   await settings.navigateToSettingsPage('ws-integrations');    // Workspace integrations
   */
  async navigateToSettingsPage(item: SettingsMenuItem): Promise<void> {
    // Workspace settings — navigate to workspace home page and click the tab
    if (item.startsWith('ws-')) {
      const wsTabMap: Record<string, string> = {
        'ws-collaborators': 'Members',
        'ws-teams': 'Teams',
        'ws-integrations': 'Integrations',
        'ws-billing': 'Billing',
        'ws-audits': 'Audits',
        'ws-sso': 'SSO',
        'ws-settings': 'Settings',
      };

      const tabLabel = wsTabMap[item];

      // Check if workspace home tabs are visible
      const wsTab = this.rootPage.locator('.nc-ws-view-tabs .tab-title', { hasText: tabLabel });

      if (!(await wsTab.isVisible().catch(() => false))) {
        // Not on workspace home — navigate there via the logo (back arrow) in the mini sidebar
        const logo = this.miniSidebarV2.getByTestId('nc-mini-sidebar-v2-logo');
        if (await logo.isVisible().catch(() => false)) {
          await logo.click();
          // Wait for workspace home to load (home sidebar appears)
          await this.rootPage.locator('.nc-home-sidebar').waitFor({ state: 'visible', timeout: 10000 });
          await this.rootPage.waitForTimeout(500);
        }
      }

      // Now click the workspace tab
      const tab = this.rootPage.locator('.nc-ws-view-tabs .tab-title', { hasText: tabLabel });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await this.rootPage.waitForTimeout(500);
        return;
      }

      // Final fallback — settings sidebar (old flow)
      await this.navigateToSettingsTab();
      const menuItem = this.getSettingsMenuItemLocator(item);
      await menuItem.waitFor({ state: 'visible' });
      await menuItem.click();
      await this.rootPage.waitForTimeout(500);
      return;
    }

    // Base settings — use settings sidebar
    await this.navigateToSettingsTab();

    const menuItem = this.getSettingsMenuItemLocator(item);
    await menuItem.waitFor({ state: 'visible' });
    await menuItem.click();
    await this.rootPage.waitForTimeout(500);
  }

  /**
   * Verifies that a settings menu item is visible.
   */
  async verifySettingsMenuItemVisible(item: SettingsMenuItem): Promise<void> {
    await this.navigateToSettingsTab();
    const menuItem = this.getSettingsMenuItemLocator(item);
    await expect(menuItem).toBeVisible();
  }

  /**
   * Verifies that a settings menu item is currently active (highlighted).
   */
  async verifySettingsMenuItemActive(item: SettingsMenuItem): Promise<void> {
    const menuItem = this.getSettingsMenuItemLocator(item);
    await expect(menuItem).toHaveClass(/active/);
  }
}
