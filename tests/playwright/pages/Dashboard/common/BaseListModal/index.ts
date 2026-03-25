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
 * The modal locator is kept as a fallback for backward compatibility.
 */
export class BaseListModalPage extends BasePage {
  readonly dashboard: DashboardPage;

  /** Legacy modal locator */
  readonly modal: Locator;

  /** Home sidebar — present when on workspace home routes */
  readonly homeSidebar: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.modal = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');
    this.homeSidebar = this.rootPage.locator('.nc-home-sidebar');
  }

  get() {
    // Return whichever container is visible
    return this.homeSidebar.or(this.modal);
  }

  /**
   * Check if we're on the workspace home page or the modal is open.
   */
  async isOpen() {
    return (await this.homeSidebar.isVisible()) || (await this.modal.isVisible());
  }

  async waitForOpen() {
    // Wait for either the home sidebar (new) or the modal (legacy)
    await this.homeSidebar.or(this.modal).waitFor({ state: 'visible', timeout: 10000 });
    await this.rootPage.waitForTimeout(300);
  }

  async waitForClose() {
    await this.rootPage.waitForTimeout(300);
  }

  async close() {
    // Modal: press Escape. Inline: no-op.
    if (await this.modal.isVisible()) {
      await this.rootPage.keyboard.press('Escape');
      await this.modal.waitFor({ state: 'hidden' });
      await this.rootPage.waitForTimeout(300);
    }
  }

  /**
   * The base list content area — targets the page content, not the sidebar.
   */
  private getContentArea(): Locator {
    return this.rootPage;
  }

  async searchBases(query: string) {
    const searchInput = this.homeSidebar.locator('.nc-home-sidebar-search input');
    if (await searchInput.isVisible()) {
      await searchInput.fill(query);
    } else {
      // Fallback to modal search
      const modalSearch = this.modal.locator('.nc-workspace-base-search input');
      await modalSearch.fill(query);
    }
    await this.rootPage.waitForTimeout(300);
  }

  async clearSearch() {
    const searchInput = this.homeSidebar.locator('.nc-home-sidebar-search input');
    if (await searchInput.isVisible()) {
      await searchInput.clear();
    } else {
      const modalSearch = this.modal.locator('.nc-workspace-base-search input');
      await modalSearch.clear();
    }
    await this.rootPage.waitForTimeout(300);
  }

  // Base operations
  getBaseNode(baseTitle: string): Locator {
    return this.getContentArea().getByTestId(`nc-base-list-modal-base-title-${baseTitle}`);
  }

  getBaseNodeById(baseId: string): Locator {
    return this.getContentArea().locator(`.nc-base-node[data-id="${baseId}"]`);
  }

  async clickBase(baseTitle: string, baseId?: string) {
    const baseNode = baseId ? this.getBaseNodeById(baseId) : this.getBaseNode(baseTitle);
    await baseNode.waitFor({ state: 'visible' });
    await baseNode.scrollIntoViewIfNeeded();
    await baseNode.click();

    // Wait for navigation — the sidebar switches from HomeSidebar to DashboardSidebar
    // which renders the treeview. Wait for the sidebar header to appear.
    await this.rootPage.locator('.nc-sidebar-header').waitFor({ state: 'visible', timeout: 10000 });
    await this.rootPage.waitForTimeout(300);
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

  // Workspace operations — use HomeSidebar
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

    const createBtn = this.homeSidebar.getByTestId('nc-home-sidebar-create-ws');
    await createBtn.click();
  }

  async clickCreateBase() {
    const createBtn = this.getContentArea().locator('[data-testid="nc-sidebar-create-base-btn"]');
    await createBtn.click();
    await this.rootPage.waitForTimeout(300);
  }

  async openCreateBaseMenuViaShortcut() {
    await this.rootPage.keyboard.press('Alt+d');
    await this.rootPage.waitForTimeout(300);
  }

  // Filter operations
  async setFilter(filter: 'all' | 'starred' | 'private' | 'owned' | 'managed') {
    const filterDropdown = this.getContentArea().locator('.nc-bases-header [data-testid="nc-base-filter-dropdown"]');
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
    const baseNodes = this.getContentArea().locator('.nc-base-node');
    await expect(baseNodes).toHaveCount(count);
  }

  async verifyWorkspaceSelected(workspaceTitle: string) {
    if (!isEE()) return;

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await expect(workspaceNode).toHaveClass(/nc-ws-node-active/);
  }
}
