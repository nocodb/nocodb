import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { isEE } from '../../../../setup/db';
import { NcContext } from '../../../../setup';
import { BaseListModalPage } from '../BaseListModal';

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

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  // readonly btn_cmdK: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;
  readonly modal_baseList: Locator;

  readonly miniSidebar: Locator;

  readonly active_base: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.baseListModal = new BaseListModalPage(dashboard);

    this.btn_workspace = this.get().locator('.nc-workspace-menu');
    // Create button is now inside the modal's header, not the sidebar
    // Using rootPage to search anywhere in the page (modal or sidebar)
    this.btn_newProject = this.rootPage.locator('[data-testid="nc-sidebar-create-base-btn"]');
    // this.btn_cmdK = this.get().locator('[data-testid="nc-sidebar-search-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');
    this.modal_baseList = this.rootPage.locator('.nc-workspace-base-list-modal-wrapper');

    this.miniSidebar = this.dashboard.get().locator('[data-testid="nc-mini-sidebar"]');

    this.active_base = this.get().locator('.nc-treeview-container.nc-treeview-container-active-base');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  /**
   * In shared base/view minisidebar will be hidden
   */
  async isMiniSidebarVisible() {
    return (await this.miniSidebar.count()) > 0;
  }

  /**
   * Opens or verifies the base list modal is open
   * @param open - If true, opens the modal if it's not already open
   * @returns boolean indicating if modal is open
   */
  async verifyBaseListOpen(open: boolean = false) {
    const isModalOpen = await this.modal_baseList.isVisible();

    if (!isModalOpen && open) {
      // Click workspace menu to open the base list modal
      await this.miniSidebarActionClick({ type: 'ws' });
      await this.baseListModal.waitForOpen();
    }

    // Wait for the modal transition to complete
    await this.rootPage.waitForTimeout(300);

    return await this.modal_baseList.isVisible();
  }

  /**
   * Opens the base list modal
   */
  async openBaseListModal() {
    if (!(await this.modal_baseList.isVisible())) {
      await this.miniSidebarActionClick({ type: 'ws' });
      await this.baseListModal.waitForOpen();
    }
  }

  /**
   * Closes the base list modal if open
   */
  async closeBaseListModal() {
    await this.baseListModal.close();
  }

  /**
   * Opens the create base menu using keyboard shortcut (Option/Alt + D)
   */
  async openCreateBaseMenuViaShortcut() {
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

    // Open base list if it's not already open
    await this.verifyBaseListOpen(true);
  }

  async clickTeamAndSettings() {
    await this.miniSidebarActionClick({
      type: 'teamAndSettings',
      fallback: async () => {
        await this.btn_teamAndSettings.click();
      },
    });
  }

  async clickWorkspace() {
    await this.miniSidebarActionClick({
      type: 'ws',
      fallback: async () => {
        await this.btn_workspace.click();
      },
    });
  }

  async clickHome() {}

  async getWorkspaceName() {
    return await this.get().locator('.nc-sidebar-header').getAttribute('data-workspace-title');
  }

  async verifyWorkspaceName({ title }: { title: string }) {
    return expect(await this.getWorkspaceName()).toContain(title);
  }

  async createWorkspace({ title }: { title: string }) {
    // Open the base list modal
    await this.openBaseListModal();

    // Click the "New Workspace" button in the modal
    const newWorkspaceBtn = this.modal_baseList.locator('button:has-text("New Workspace")');
    await newWorkspaceBtn.waitFor();
    await newWorkspaceBtn.click();

    // Fill in the workspace creation dialog
    const inputModal = this.rootPage.locator('div.ant-modal.active').last();
    await inputModal.waitFor();
    await inputModal.locator('input').clear();
    await inputModal.locator('input').fill(title);
    await inputModal.locator('button.ant-btn-primary').click();
  }

  async verifyWorkspaceCount({ count }: { count: number }) {
    // Open the base list modal
    await this.openBaseListModal();

    // Count workspace nodes in the modal
    const workspaceNodes = this.modal_baseList.locator('.nc-workspace-node');
    await expect(workspaceNodes).toHaveCount(count);

    // Close the modal
    await this.closeBaseListModal();
  }

  getWorkspaceNode(workspaceTitle: string) {
    // Use the title class for precise matching
    return this.modal_baseList.locator('.nc-workspace-node').filter({
      has: this.rootPage.locator('.nc-workspace-node-title', { hasText: workspaceTitle }),
    });
  }

  async isWorkspaceSelected(workspaceTitle: string): Promise<boolean> {
    const workspaceNode = this.getWorkspaceNode(workspaceTitle);
    const classAttr = await workspaceNode.getAttribute('class');
    return classAttr?.includes('nc-selected-workspace-node') ?? false;
  }

  async getWorkspaceList() {
    const ws: string[] = [];

    // Open the base list modal
    await this.openBaseListModal();

    // Get workspace titles from the modal using the title class
    const titles = this.modal_baseList.locator('.nc-workspace-node-title');
    const count = await titles.count();

    for (let i = 0; i < count; i++) {
      const title = await titles.nth(i).textContent();
      if (title) ws.push(title.trim());
    }

    // Close the modal
    await this.closeBaseListModal();

    return ws;
  }

  async openWorkspace(param: { title: string }) {
    // Open the base list modal
    await this.openBaseListModal();
    await this.rootPage.waitForTimeout(300);

    // Check if this workspace is already selected/active
    if (await this.isWorkspaceSelected(param.title)) {
      // Already on this workspace, just close the modal
      await this.closeBaseListModal();
      return;
    }

    // Find and click the navigate icon for the workspace
    const workspaceNode = this.getWorkspaceNode(param.title);
    await workspaceNode.locator('.nc-workspace-node-navigate-icon').click();

    // Wait for navigation
    await this.rootPage.waitForTimeout(2000);

    // Close modal if still open
    await this.closeBaseListModal();
  }

  async getMiniSidebarActionLocator({ type }: { type: MiniSidebarActionType }): Promise<Locator | undefined> {
    await this.miniSidebar.waitFor();

    const locators = {
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

      // wait for transition to complete
      await this.rootPage.waitForTimeout(500);
    }
  }

  async verifyMiniSidebarActions({
    types = [],
    isVisible = true,
  }: {
    types: MiniSidebarActionType[];
    isVisible: boolean;
  }) {
    for (const type of types) {
      const locator = await this.getMiniSidebarActionLocator({ type });

      if (isVisible) await expect(locator).toBeVisible();
      else await expect(locator).not.toBeVisible();
    }
  }
}
