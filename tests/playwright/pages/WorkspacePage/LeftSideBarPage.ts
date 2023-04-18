import BasePage from '../Base';
import { WorkspacePage } from './';
import { expect, Locator } from '@playwright/test';

/*
  nc-left-sidebar
    nc-workspace-group
      > Recent
      > Shared with me
      > Favourites

    All Workspaces
      data-testid="nc-create-workspace"

    ul.nc-workspace-list
      nc-workspace-title
        span:nth-child(0) : workspace title
        span:nth-child(1) : workspace owner : displayed on hover
      nc-workspace-drag-icon
      nc-icon.nc-workspace-menu (...) : click
        |> .ant-dropdown-menu-vertical
            |> .ant-dropdown-menu-item : Rename Workspace
            |> .ant-dropdown-menu-item : Delete Workspace
 */

export class LeftSideBarPage extends BasePage {
  readonly workspace: WorkspacePage;
  readonly recentWorkspaces: Locator;
  readonly sharedWithMeWorkspaces: Locator;
  readonly favouriteWorkspaces: Locator;
  readonly createWorkspace: Locator;
  readonly workspaceItems: Locator;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
    this.recentWorkspaces = this.get().locator('.nc-workspace-group').locator('span:has-text("Recent")');
    this.sharedWithMeWorkspaces = this.get().locator('.nc-workspace-group').locator('span:has-text("Shared with me")');
    this.favouriteWorkspaces = this.get().locator('.nc-workspace-group').locator('span:has-text("Favourites")');
    this.createWorkspace = this.get().locator('[data-testid="nc-create-workspace"]');
    this.workspaceItems = this.get().locator('.nc-workspace-title');
  }

  get() {
    return this.workspace.get().locator('.nc-left-sidebar');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  async getWorkspaceCount() {
    return (await this.workspaceItems).count();
  }

  async verifyStaticElements() {
    await this.get().locator('.nc-workspace-group').waitFor({ state: 'visible' });
    await this.recentWorkspaces.waitFor({ state: 'visible' });
    await this.sharedWithMeWorkspaces.waitFor({ state: 'visible' });
    await this.favouriteWorkspaces.waitFor({ state: 'visible' });
    await this.createWorkspace.waitFor({ state: 'visible' });
  }

  async verifyDynamicElements(param: ({ role: string; title: string } | { role: string; title: string })[]) {
    expect(await this.getWorkspaceCount()).toBe(param.length);

    for (const { role, title } of param) {
      const ws = this.get().locator(`li.ant-menu-item:has-text("${title}")`);
      await ws.waitFor({ state: 'visible' });

      // todo: verify role
    }
  }
}
