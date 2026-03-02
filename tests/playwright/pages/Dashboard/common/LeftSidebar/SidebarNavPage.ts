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
  | 'automations'
  | 'notification'
  | 'theme'
  | 'agents'
  | 'settings'
  | 'support'
  | 'bookmarks'
  | 'more';

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
    if (['data', 'automations', 'settings'].includes(tab)) {
      const classList = await tabLocator.getAttribute('class');
      if (classList?.includes('active')) return;
    }

    await tabLocator.click();
    await this.rootPage.waitForTimeout(500);
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
   * Navigates to the Automation section via MiniSidebarV2.
   * Falls back silently if V2 is not present.
   */
  async navigateToAutomationTab(): Promise<void> {
    if (await this.isMiniSidebarV2Visible()) {
      await this.clickMiniSidebarV2Tab('automations');
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
      return sidebar.getByTestId(item);
    }

    // Base settings items
    return sidebar.getByTestId(`base-${item}`);
  }

  /**
   * Navigates to a specific settings page by clicking the settings tab
   * (if not already active) and then clicking the target menu item.
   *
   * @example
   *   await settings.navigateToSettingsPage('collaborator');       // Base members
   *   await settings.navigateToSettingsPage('ws-integrations');    // Workspace integrations
   */
  async navigateToSettingsPage(item: SettingsMenuItem): Promise<void> {
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
