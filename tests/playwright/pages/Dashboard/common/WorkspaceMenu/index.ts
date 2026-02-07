import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';

export class WorkspaceMenuObject extends BasePage {
  constructor(parent: GridPage | GalleryPage | KanbanPage | FormPage) {
    super(parent.rootPage);
  }

  get() {
    // Return the new base list modal instead of dropdown
    return this.rootPage.locator(`.nc-workspace-base-list-modal-wrapper`);
  }

  getModal() {
    return this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');
  }

  async isModalOpen() {
    return this.getModal().isVisible();
  }

  async toggle() {
    await this.rootPage.locator('[data-testid="nc-workspace-menu"]').click();
    await this.rootPage.waitForTimeout(300);
  }

  async openModal() {
    if (!(await this.isModalOpen())) {
      await this.toggle();
      await this.getModal().waitFor({ state: 'visible' });
    }
  }

  async closeModal() {
    if (await this.isModalOpen()) {
      await this.rootPage.keyboard.press('Escape');
      await this.getModal().waitFor({ state: 'hidden' });
    }
  }

  getWorkspaceNode(workspaceTitle: string) {
    // Use the title class for precise matching
    return this.getModal()
      .locator('.nc-workspace-node')
      .filter({
        has: this.rootPage.locator('.nc-workspace-node-title', { hasText: workspaceTitle }),
      });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-selected-workspace-node') ?? false;
  }

  async switchWorkspace({ workspaceTitle }: { workspaceTitle: string }) {
    // Open the base list modal
    await this.openModal();
    await this.rootPage.waitForTimeout(300);

    // Check if this workspace is already selected/active
    if (await this.isWorkspaceSelected(workspaceTitle)) {
      // Already on this workspace, just close the modal
      await this.closeModal();
      return;
    }

    // Click the navigate icon to switch to workspace
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await workspaceNode.locator('.nc-workspace-node-navigate-icon').click();

    await this.rootPage.waitForTimeout(2000);

    // Close modal if still open
    await this.closeModal();
  }

  async selectWorkspace({ workspaceTitle }: { workspaceTitle: string }) {
    // Open the base list modal
    await this.openModal();
    await this.rootPage.waitForTimeout(300);

    // Click the workspace node to select (view its bases, not navigate)
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    await workspaceNode.click();

    await this.rootPage.waitForTimeout(500);
  }

  async click({ menu, subMenu }: { menu: string; subMenu: string }) {
    const pMenu = this.rootPage.locator(`.nc-dropdown-workspace-menu:visible`);
    await pMenu.locator(`div.nc-workspace-menu-item:has-text("${menu}"):visible`).click();
    await this.rootPage.waitForTimeout(2000);

    if (subMenu) {
      await this.rootPage.locator(`div.nc-workspace-menu-item:has-text("${subMenu}"):visible`).click();
      await this.rootPage.waitForTimeout(1000);
    }
  }

  async clickPreview(role: string) {
    await this.click({
      menu: 'Preview as',
      subMenu: role,
    });
    await this.rootPage.waitForTimeout(2500);
  }

  // Base operations through the modal
  async clickBase({ baseTitle }: { baseTitle: string }) {
    await this.openModal();
    await this.rootPage.waitForTimeout(300);

    const baseNode = this.getModal().locator('.nc-base-node').filter({ hasText: baseTitle });
    await baseNode.click();

    // Modal should close after selecting a base
    await this.rootPage.waitForTimeout(500);
  }

  async searchBases(query: string) {
    await this.openModal();
    const searchInput = this.getModal().locator('.nc-workspace-base-search input');
    await searchInput.fill(query);
    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Opens the create base menu using keyboard shortcut (Option/Alt + D)
   */
  async openCreateBaseMenuViaShortcut() {
    await this.rootPage.keyboard.press('Alt+d');
    await this.rootPage.waitForTimeout(300);
  }
}
