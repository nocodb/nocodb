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
    return this.workspaceItems.count();
  }

  async verifyStaticElements() {
    // await this.get().locator('.nc-workspace-group').waitFor({ state: 'visible' });
    // await this.recentWorkspaces.waitFor({ state: 'visible' });
    // await this.sharedWithMeWorkspaces.waitFor({ state: 'visible' });
    // await this.favouriteWorkspaces.waitFor({ state: 'visible' });
    await this.createWorkspace.waitFor({ state: 'visible' });
  }

  async verifyDynamicElements(param: ({ role: string; title: string } | { role: string; title: string })[]) {
    // parallel execution, can't predict how many will be active
    // expect(await this.getWorkspaceCount()).toBe(param.length);

    //@ts-ignore
    for (const { role, title } of param) {
      const ws = this.get().locator(`li.ant-menu-item:has-text("${title}")`).first();
      await ws.waitFor({ state: 'visible' });

      // todo: verify role
    }
  }

  async workspaceGetLocator(title: string) {
    // get workspace id
    // return this.get().locator('[data-id="' + wsId + '"]');
    const list = this.get().locator(`.nc-workspace-list-item`);
    for (let i = 0; i < (await list.count()); i++) {
      const ws = list.nth(i);
      const wsTitle = (await ws.innerText()).split('\n')[1];
      if (wsTitle === title) {
        return ws;
      }
    }
    return null;
  }

  async workspaceList() {
    const wsList = this.workspaceItems;
    // for each, extract title and add to array
    const titles = [];
    for (let i = 0; i < (await wsList.count()); i++) {
      const title = await wsList.nth(i).innerText();
      titles.push(title);
    }
    return titles;
  }

  async workspaceCreate({ title }: { title: string }) {
    await this.createWorkspace.click();
    const modal = this.rootPage.locator('div.ant-modal.active');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('input[data-testid="create-workspace-title-input"]').fill(title);

    await this.waitForResponse({
      uiAction: () => modal.locator('button:has-text("Create Workspace")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/workspaces`,
    });
  }

  async workspaceRename({ title, newTitle }: { title: string; newTitle: string }) {
    const ws = await this.workspaceGetLocator(title);
    await ws.click();
    await ws.locator('.nc-workspace-menu').waitFor({ state: 'visible' });
    await ws.locator('.nc-workspace-menu').click();
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

    // GET will be triggered after DELETE
    await this.waitForResponse({
      uiAction: async () => {
        // Create a promise that resolves after 1 second
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        // Returning a promise that resolves with the result after the 1-second delay
        await delay(500);
        return await this.rootPage.locator('button:has-text("Delete Workspace")').click();
      },
      // uiAction: () => this.rootPage.locator('button:has-text("Delete Workspace")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/workspaces/`,
    });
  }

  async openQuickAccess(menu: 'Recent' | 'Shared with me' | 'Favourites') {
    await this.get().locator('.nc-workspace-group').locator(`span:has-text("${menu}")`).click();

    const URL = {
      Recent: `http://localhost:3000/#/?page=recent`,
      'Shared with me': `http://localhost:3000/#/?page=shared`,
      Favourites: `http://localhost:3000/#/?page=starred`,
    };

    // verify current URL to be /workspaces
    expect(this.rootPage.url()).toBe(URL[menu]);
  }
}
