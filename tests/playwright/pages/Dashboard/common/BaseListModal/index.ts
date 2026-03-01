import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { isEE } from '../../../../setup/db';

export class BaseListModalPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly modal: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.modal = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');
  }

  get() {
    return this.modal;
  }

  async isOpen() {
    return this.modal.isVisible();
  }

  async waitForOpen() {
    await this.modal.waitFor({ state: 'visible' });
    // Wait for modal animation to complete
    await this.rootPage.waitForTimeout(300);

    await this.rootPage.getByTestId('nc-base-list-loading').waitFor({ state: 'hidden' });
  }

  async waitForClose() {
    await this.modal.waitFor({ state: 'hidden' });

    // Wait for modal animation to complete
    await this.rootPage.waitForTimeout(300);
  }

  async close() {
    if (await this.isOpen()) {
      await this.rootPage.keyboard.press('Escape');
      await this.waitForClose();
    }
  }

  async searchBases(query: string) {
    const searchInput = this.modal.locator('.nc-workspace-base-search input');
    await searchInput.fill(query);
    await this.rootPage.waitForTimeout(300);
  }

  async clearSearch() {
    const searchInput = this.modal.locator('.nc-workspace-base-search input');
    await searchInput.clear();
    await this.rootPage.waitForTimeout(300);
  }

  // Base operations
  getBaseNode(baseTitle: string): Locator {
    // Use data-testid for precise matching
    return this.modal.getByTestId(`nc-base-list-modal-base-title-${baseTitle}`);
  }

  getBaseNodeById(baseId: string): Locator {
    // Use data-id for matching by base ID
    return this.modal.locator(`.nc-base-node[data-id="${baseId}"]`);
  }

  async clickBase(baseTitle: string, baseId?: string) {
    const baseNode = baseId ? this.getBaseNodeById(baseId) : this.getBaseNode(baseTitle);
    await baseNode.waitFor({ state: 'visible' });
    await baseNode.scrollIntoViewIfNeeded();
    await baseNode.click();

    await this.waitForClose();
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
    await this.waitForClose();
  }

  async deleteBase(baseTitle: string) {
    await this.openBaseMenu(baseTitle);
    await this.rootPage.getByTestId('nc-base-node-delete').click();
  }

  // Workspace operations (EE only)
  getWorkspaceNode(workspaceTitle: string): Locator {
    // Use the title class for precise matching
    return this.modal.locator('.nc-workspace-node').filter({
      has: this.rootPage.locator('.nc-workspace-node-title', { hasText: workspaceTitle }),
    });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-selected-workspace-node') ?? false;
  }

  async selectWorkspace(workspaceTitle: string) {
    if (!isEE()) return;

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await workspaceNode.click();
    await this.rootPage.waitForTimeout(500);
  }

  async switchWorkspace(workspaceTitle: string) {
    if (!isEE()) return;

    // Check if this workspace is already selected/active
    if (await this.isWorkspaceSelected(workspaceTitle)) {
      // Already on this workspace, just close the modal
      await this.close();
      return;
    }

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    // Click the navigate icon to switch to workspace
    await workspaceNode.locator('.nc-workspace-node-navigate-icon').click();
    await this.rootPage.waitForTimeout(1000);
  }

  async createWorkspace() {
    if (!isEE()) return;

    const createBtn = this.modal.locator('button:has-text("New Workspace")');
    await createBtn.click();
  }

  /**
   * Click the create base button in the modal header
   */
  async clickCreateBase() {
    const createBtn = this.modal.locator('[data-testid="nc-sidebar-create-base-btn"]');
    await createBtn.click();
    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Opens the create base menu using keyboard shortcut (Option/Alt + D)
   * This works from anywhere in the app, modal doesn't need to be open
   */
  async openCreateBaseMenuViaShortcut() {
    await this.rootPage.keyboard.press('Alt+d');
    await this.rootPage.waitForTimeout(300);
  }

  // Filter operations
  async setFilter(filter: 'all' | 'starred' | 'private' | 'owned' | 'managed') {
    const filterDropdown = this.modal.locator('.nc-bases-header [data-testid="nc-base-filter-dropdown"]');
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
    const baseNodes = this.modal.locator('.nc-base-node');
    await expect(baseNodes).toHaveCount(count);
  }

  async verifyWorkspaceSelected(workspaceTitle: string) {
    if (!isEE()) return;

    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await expect(workspaceNode).toHaveClass(/nc-selected-workspace-node/);
  }
}
