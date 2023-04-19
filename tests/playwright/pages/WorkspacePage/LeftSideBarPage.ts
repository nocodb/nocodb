import BasePage from '../Base';
import { WorkspacePage } from './';
import { expect, Locator } from '@playwright/test';
import { getWorkspaceId } from '../../setup';

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


  Workspace create modal
  ----------------------
  nc-modal-workspace-create
    input[data-testid="create-workspace-ws-name"]
    input[data-testid="create-workspace-ws-description"]
      ant-modal-close-x
      button:has-text("Submit")
      button:has-text("Cancel")

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

  async workspaceGetLocator(title: string) {
    // get workspace id
    const wsId = await getWorkspaceId(title);
    console.log('wsId', wsId);
    return this.get().locator('[data-id="' + wsId + '"]');
  }

  async workspaceList() {
    const wsList = await this.workspaceItems;
    // for each, extract title and add to array
    const titles = [];
    for (let i = 0; i < (await wsList.count()); i++) {
      const title = await wsList.nth(i).innerText();
      titles.push(title);
    }
    return titles;
  }

  async workspaceCreate({ title, description }: { title: string; description: string }) {
    await this.createWorkspace.click();
    const modal = this.rootPage.locator('div.ant-modal.active');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('input[data-testid="create-workspace-title-input"]').fill(title);
    await modal.locator('textarea[data-testid="create-workspace-description-input"]').fill(description);

    await this.waitForResponse({
      uiAction: () => modal.locator('button:has-text("Submit")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/workspaces`,
    });
  }

  async workspaceRename({ title, newTitle }: { title: string; newTitle: string }) {
    const ws = await this.workspaceGetLocator(title);
    await ws.click();
    await ws.locator('.nc-icon.nc-workspace-menu').waitFor({ state: 'visible' });
    await ws.locator('.nc-icon.nc-workspace-menu').click();
    await this.rootPage
      .locator('.ant-dropdown-menu-vertical:visible')
      .locator('.ant-dropdown-menu-item:has-text("Rename Workspace")')
      .click();
    await ws.locator('input').waitFor({ state: 'visible' });
    await ws.locator('input').fill(newTitle);
    // await this.rootPage.keyboard.press('Enter');

    await this.waitForResponse({
      uiAction: () => this.rootPage.keyboard.press('Enter'),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `api/v1/workspaces/`,
    });
  }

  async workspaceDelete({ title }: { title: string }) {
    const ws = await this.workspaceGetLocator(title);
    await ws.click();
    await ws.locator('.nc-icon.nc-workspace-menu').waitFor({ state: 'visible' });
    await ws.locator('.nc-icon.nc-workspace-menu').click();
    await this.rootPage
      .locator('.ant-dropdown-menu-vertical:visible')
      .locator('.ant-dropdown-menu-item:has-text("Delete Workspace")')
      .click();

    // GET will be triggered subsequent to DELETE
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.ant-modal-confirm').locator('button:has-text("OK")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/workspaces/`,
    });
  }
}
