import { Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

export class LeftSidebarPage extends BasePage {
  readonly project: any;
  readonly dashboard: DashboardPage;

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  readonly btn_cmdK: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.btn_workspace = this.get().locator('.nc-sidebar-header');
    this.btn_newProject = this.get().locator('[data-testid="nc-sidebar-create-project-btn"]');
    this.btn_cmdK = this.get().locator('[data-testid="nc-sidebar-search-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  async createProject({ title }: { title: string }) {
    await this.btn_newProject.click();
    await this.rootPage.locator('.ant-modal-content:has-text(" Create Database")').waitFor();
    await this.rootPage.locator('.ant-modal-content:has-text(" Create Database")').locator('input').fill(title);
    await this.rootPage
      .locator('.ant-modal-content:has-text(" Create Database")')
      .locator('button.ant-btn-primary')
      .click();
  }

  async clickTeamAndSettings() {
    await this.btn_teamAndSettings.click();
  }

  async clickWorkspace() {
    await this.btn_workspace.click();
  }

  async clickHome() {}

  async getWorkspaceName() {
    return await this.btn_workspace.getAttribute('data-workspace-title');
  }

  async createWorkspace({ title }: { title: string }) {
    await this.clickWorkspace();
    await this.modal_workspace.locator('.ant-dropdown-menu-item:has-text("Create New Workspace")').waitFor();
    await this.modal_workspace.locator('.ant-dropdown-menu-item:has-text("Create New Workspace")').click();

    const inputModal = this.rootPage.locator('div.ant-modal.active');
    await inputModal.waitFor();
    await inputModal.locator('input').clear();
    await inputModal.locator('input').fill(title);
    await inputModal.locator('button.ant-btn-primary').click();
  }

  async getWorkspaceList() {
    const ws = [];
    await this.clickWorkspace();
    const nodes = this.modal_workspace.locator('[data-testid="nc-workspace-list"]');

    for (let i = 0; i < (await nodes.count()); i++) {
      ws.push(await getTextExcludeIconText(nodes.nth(i)));
    }

    ws.push(await this.getWorkspaceName());
    await this.rootPage.keyboard.press('Escape');

    return ws;
  }

  async openWorkspace(param: { title: any }) {
    await this.clickWorkspace();
    const nodes = this.modal_workspace.locator('[data-testid="nc-workspace-list"]');

    for (let i = 0; i < (await nodes.count()); i++) {
      const text = await getTextExcludeIconText(nodes.nth(i));
      if (text.toLowerCase() === param.title.toLowerCase()) {
        await nodes.nth(i).click();
        break;
      }
    }
    await this.rootPage.keyboard.press('Escape');
  }
}
