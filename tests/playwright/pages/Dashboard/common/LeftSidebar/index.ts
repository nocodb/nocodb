import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { isEE } from '../../../../setup/db';
import { NcContext } from '../../../../setup';

export class LeftSidebarPage extends BasePage {
  readonly base: any;
  readonly dashboard: DashboardPage;

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  readonly btn_cmdK: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.btn_workspace = this.get().locator('.nc-workspace-menu');
    this.btn_newProject = this.get().locator('[data-testid="nc-sidebar-create-base-btn"]');
    this.btn_cmdK = this.get().locator('[data-testid="nc-sidebar-search-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  async createProject({ title, context }: { title: string; context: NcContext }) {
    title = isEE() ? title : `nc-${context.workerId}-${title}`;
    await this.btn_newProject.click();
    await this.rootPage.locator('.ant-modal-content:has-text(" Create Base")').waitFor();
    await this.rootPage.locator('.ant-modal-content:has-text(" Create Base")').locator('input').fill(title);
    await this.rootPage
      .locator('.ant-modal-content:has-text(" Create Base")')
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

  async verifyWorkspaceName({ title }: { title: string }) {
    await expect(this.btn_workspace.locator('.nc-workspace-title')).toHaveText(title);
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

  async verifyWorkspaceCount({ count }: { count: number }) {
    await this.clickWorkspace();

    // TODO: THere is one extra html attribute
    await expect(this.rootPage.getByTestId('nc-workspace-list')).toHaveCount(count + 1);
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

    await this.rootPage.waitForTimeout(2000);

    for (let i = 0; i < (await nodes.count()); i++) {
      const text = await getTextExcludeIconText(nodes.nth(i));
      if (text.toLowerCase() === param.title.toLowerCase()) {
        await nodes.nth(i).click({ force: true });
        break;
      }
    }
    await this.rootPage.keyboard.press('Escape');

    await this.rootPage.waitForTimeout(3500);
  }
}
