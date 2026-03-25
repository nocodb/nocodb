import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { isEE } from '../../../../setup/db';

/**
 * Page object for the workspace base list.
 *
 * Previously this targeted the BaseListModal (modal popup).
 * Now it targets the inline WorkspaceBaseList component rendered
 * on the workspace home page (/{wsId} route, Bases tab).
 *
 * The modal_baseList locator is kept as a fallback for backward compatibility
 * in case the modal is still used in some flows.
 */
export class BaseListModalPage extends BasePage {
  readonly dashboard: DashboardPage;

  /** Legacy modal locator — kept for backward compat */
  readonly modal: Locator;

  /** Inline base list on workspace home page */
  readonly baseList: Locator;

  /** Home sidebar (workspace list) */
  readonly homeSidebar: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.modal = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');
    this.baseList = this.rootPage.locator('.nc-workspace-home');
    this.homeSidebar = this.rootPage.locator('.nc-home-sidebar');
  }

  get() {
    return this.baseList;
  }

  /**
   * Check if we're on the workspace home page (bases tab visible).
   */
  async isOpen() {
    return this.baseList.isVisible() || this.modal.isVisible();
  }

  async waitForOpen() {
    // Try inline base list first, then fall back to modal
    try {
      await this.baseList.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      await this.modal.waitFor({ state: 'visible' });
    }
    await this.rootPage.waitForTimeout(300);
  }

  async waitForClose() {
    // For inline view, "close" means navigating away from workspace home
    await this.rootPage.waitForTimeout(300);
  }

  async close() {
    // Modal: press Escape. Inline: no-op (already on the page).
    if (await this.modal.isVisible()) {
      await this.rootPage.keyboard.press('Escape');
      await this.modal.waitFor({ state: 'hidden' });
      await this.rootPage.waitForTimeout(300);
    }
  }

  async searchBases(query: string) {
    // Search is now in the home sidebar
    const searchInput = this.homeSidebar.locator('.nc-home-sidebar-search input');
    await searchInput.fill(query);
    await this.rootPage.waitForTimeout(300);
  }

  async clearSearch() {
    const searchInput = this.homeSidebar.locator('.nc-home-sidebar-search input');
    await searchInput.clear();
    await this.rootPage.waitForTimeout(300);
  }

  // Base operations — target both inline and modal
  private getContainer(): Locator {
    // Prefer inline base list, fall back to modal
    return this.baseList.or(this.modal);
  }

  getBaseNode(baseTitle: string): Locator {
    return this.getContainer().getByTestId(`nc-base-list-modal-base-title-${baseTitle}`);
  }

  getBaseNodeById(baseId: string): Locator {
    return this.getContainer().locator(`.nc-base-node[data-id="${baseId}"]`);
  }

  async clickBase(baseTitle: string, baseId?: string) {
    const baseNode = baseId ? this.getBaseNodeById(baseId) : this.getBaseNode(baseTitle);
    await baseNode.waitFor({ state: 'visible' });
    await baseNode.scrollIntoViewIfNeeded();
    await baseNode.click();

    // Wait for navigation
    await this.rootPage.waitForTimeout(500);
  }

  async openBaseMenu(baseTitle: string) {
    const baseNode = this.getBaseNode(baseTitle);
    await baseNode.hover();
    await baseNode.locator('.nc-base-node-menu-btn').click();
    await this.rootPage.waitForTimeout(200);
  }

  async renameBase(baseTitle: string, newTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-rename').click();
    const baseNode = this.getBaseNode(baseTitle);
    const input = baseNode.locator('input');
    await input.fill(newTitle);
    await input.press('Enter');
    await this.rootPage.waitForTimeout(500);
  }

  async toggleBaseStarred(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-starred').click();
    await this.rootPage.waitForTimeout(500);
  }

  async duplicateBase(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-duplicate').click();
  }

  async openBaseErd(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-erd').click();
  }

  async openBaseSettings(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-settings').click();
    await this.rootPage.waitForTimeout(500);
  }

  async deleteBase(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-delete').click();
  }

  // Workspace operations — now use HomeSidebar instead of modal right panel
  getWorkspaceNode(workspaceTitle: string): Locator {
    return this.homeSidebar.locator(`[data-testid^="nc-home-sidebar-ws-"]`).filter({
      hasText: workspaceTitle,
    });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-ws-node-active') ?? false;
  }

  async selectWorkspace(workspaceTitle: string) {
    if (!isEE()) return;

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await workspaceNode.click();
    await this.rootPage.waitForTimeout(1000);
  }

  async switchWorkspace(workspaceTitle: string) {
    if (!isEE()) return;

    if (await this.isWorkspaceSelected(workspaceTitle)) {
      return;
    }

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await workspaceNode.click();
    await this.rootPage.waitForTimeout(1000);
  }

  async createWorkspace() {
    if (!isEE()) return;

    // Click the + button in sidebar workspace header
    const createBtn = this.homeSidebar.getByTestId('nc-home-sidebar-create-ws');
    await createBtn.click();
  }

  async clickCreateBase() {
    const createBtn = this.getContainer().locator('[data-testid="nc-sidebar-create-base-btn"]');
    await createBtn.click();
    await this.rootPage.waitForTimeout(300);
  }

  async openCreateBaseMenuViaShortcut() {
    await this.rootPage.keyboard.press('Alt+d');
    await this.rootPage.waitForTimeout(300);
  }

  // Filter operations
  async setFilter(filter: 'all' | 'starred' | 'private' | 'owned' | 'managed') {
    const filterDropdown = this.getContainer().locator('.nc-bases-header [data-testid="nc-base-filter-dropdown"]');
    await filterDropdown.click();
    await this.rootPage.waitForTimeout(200);

    const filterOption = this.rootPage.locator(`.ant-dropdown:visible .ant-dropdown-menu-item:has-text("${filter}")`);
    await filterOption.click();
    await this.rootPage.waitForTimeout(300);
  }

  // Verification methods
  async verifyBaseExists(baseTitle: string) {
    const baseNode = this.getBaseNode(baseTitle);
    await expect(baseNode).toBeVisible();
  }

  async verifyBaseNotExists(baseTitle: string) {
    const baseNode = this.getBaseNode(baseTitle);
    await expect(baseNode).not.toBeVisible();
  }

  async verifyBaseCount(count: number) {
    const baseNodes = this.getContainer().locator('.nc-base-node');
    await expect(baseNodes).toHaveCount(count);
  }

  async verifyWorkspaceSelected(workspaceTitle: string) {
    if (!isEE()) return;

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await expect(workspaceNode).toHaveClass(/nc-ws-node-active/);
  }
}
