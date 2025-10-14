import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '../../index';
import BasePage from '../../../Base';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { isEE } from '../../../../setup/db';
import { NcContext } from '../../../../setup';

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

  readonly btn_workspace: Locator;
  readonly btn_newProject: Locator;
  // readonly btn_cmdK: Locator;
  readonly btn_teamAndSettings: Locator;

  readonly modal_workspace: Locator;

  readonly miniSidebar: Locator;

  readonly active_base: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.btn_workspace = this.get().locator('.nc-workspace-menu');
    this.btn_newProject = this.get().locator('[data-testid="nc-sidebar-create-base-btn"]');
    // this.btn_cmdK = this.get().locator('[data-testid="nc-sidebar-search-btn"]');
    this.btn_teamAndSettings = this.get().locator('[data-testid="nc-sidebar-team-settings-btn"]');

    this.modal_workspace = this.rootPage.locator('.nc-dropdown-workspace-menu');

    this.miniSidebar = this.dashboard.get().locator('[data-testid="nc-mini-sidebar"]');

    this.active_base = this.get().locator('.nc-treeview-container.nc-treeview-container-active-base');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
  }

  async isNewSidebar() {
    // will be new sidebar always from now
    return 1;
  }

  /**
   * In shared base/view minisidebar will be hidden
   */
  async isMiniSidebarVisible() {
    return (await this.miniSidebar.count()) > 0;
  }

  async verifyBaseListOpen(open: boolean = false) {
    if (!(await this.isNewSidebar())) return true;

    if (!(await this.get().isVisible())) {
      await this.miniSidebarActionClick({ type: 'base' });
    }

    const classAttr = await this.get().locator('.nc-treeview-container').getAttribute('class');

    const isListOpen = classAttr?.includes('nc-treeview-container-base-list') ?? false;

    if (!isListOpen && open) {
      await this.miniSidebarActionClick({ type: 'base' });
    }

    // Wait for the sidebar list transition to complete
    await this.rootPage.waitForTimeout(500);

    return isListOpen;
  }

  async createProject({ title, context }: { title: string; context: NcContext }) {
    title = isEE() ? title : `nc-${context.workerId}-${title}`;
    await this.verifyBaseListOpen(true);

    await this.btn_newProject.click();

    if (isEE()) {
      await this.rootPage.locator('.nc-create-base').waitFor();
      await this.rootPage.locator('.nc-create-base').click();
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
    if (await this.isNewSidebar()) {
      return await this.get().locator('.nc-sidebar-header').getAttribute('data-workspace-title');
    } else {
      return await this.btn_workspace.getAttribute('data-workspace-title');
    }
  }

  async verifyWorkspaceName({ title }: { title: string }) {
    if (await this.isNewSidebar()) {
      return expect(await this.getWorkspaceName()).toContain(title);
    } else {
      return await expect(this.btn_workspace.locator('.nc-workspace-title')).toHaveText(title);
    }
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
      const text = await getTextExcludeIconText(nodes.nth(i).getByTestId('nc-workspace-list-title'));
      if (text.toLowerCase() === param.title.toLowerCase()) {
        await nodes.nth(i).click({ force: true });
        break;
      }
    }
    await this.rootPage.keyboard.press('Escape');

    await this.rootPage.waitForTimeout(3500);
  }

  async getMiniSidebarActionLocator({ type }: { type: MiniSidebarActionType }): Promise<Locator | undefined> {
    if (!(await this.isNewSidebar())) {
      return undefined;
    }

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
    if (!(await this.isNewSidebar()) || !(await this.isMiniSidebarVisible())) {
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
