import BasePage from '../Base';
import { WorkspacePage } from './';
import { expect } from '@playwright/test';
import { Locator } from '@playwright/test';
import { getTextExcludeIconText } from '../../tests/utils/general';

/*
  nc-workspace-settings
    nc-workspace-avatar
    nc-workspace-title
    button:has-text("New Base")
      |> .ant-dropdown-menu-vertical
          |> .ant-dropdown-menu-item : Database           nc-create-base-btn-db
              nc-shortcut-label-wrapper.nc-shortcut-label
          |> .ant-dropdown-menu-item : Documentation      nc-create-base-btn-docs
              nc-shortcut-label-wrapper.nc-shortcut-label

    ant-tabs-nav-list
      ant-tabs-tab : All Projects
      ant-tabs-tab : Collaborators

    thead.ant-table-thead
      tr.ant-table-row
        td.ant-table-cell (nc-base-title)
          material-symbols : database
          span : base title
          nc-icon : favourites icon
        td.ant-table-cell (color)
        td.ant-table-cell (last accessed)
        td.ant-table-cell (my role)
        td.ant-table-cell (actions)
          nc-icon (...) : click
            |> .ant-dropdown-menu-item : Rename Base
            |> .ant-dropdown-menu-item : Move Base
            |> .ant-dropdown-menu-item : Delete Base
 */

export class ContainerPage extends BasePage {
  readonly workspace: WorkspacePage;
  readonly newProjectButton: Locator;

  // tabs
  readonly bases: Locator;
  readonly collaborators: Locator;
  readonly billing: Locator;
  readonly settings: Locator;

  // list
  readonly moreActions: Locator;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
    this.newProjectButton = this.get().locator('button:has-text("New Base")');

    // tabs
    this.bases = this.get().locator('.ant-tabs-tab:has-text("Projects")');
    this.collaborators = this.get().locator('.ant-tabs-tab:has-text("Members")');
    this.billing = this.get().locator('.ant-tabs-tab:has-text("Billing")');
    this.settings = this.get().locator('.ant-tabs-tab:has-text("Settings")');

    // list
    this.moreActions = this.get().locator('td.ant-table-cell >> .nc-workspace-menu');
  }

  get() {
    return this.workspace.get().locator('.nc-workspace-settings');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  async verifyStaticElements() {
    const tableHeaderCells = this.get().locator('.ant-table-thead > tr > th.ant-table-cell');
    expect(await tableHeaderCells.count()).toBe(5);
    expect(await tableHeaderCells.nth(0).innerText()).toBe('Base Name');
    expect(await tableHeaderCells.nth(1).innerText()).toBe('Role');
    expect(await tableHeaderCells.nth(2).innerText()).toBe('Last Opened');
    // actions column
    expect(await tableHeaderCells.nth(3).innerText()).toBe('');

    const tabs = this.get().locator('.ant-tabs-tab-btn');
    expect(await tabs.count()).toBe(3);
    await expect(this.bases).toBeVisible();
    await expect(this.collaborators).toBeVisible();
    await expect(this.billing).toBeVisible();

    await expect(this.newProjectButton).toBeVisible();
  }

  async getProjectRowData({ index, skipWs = false }: { index: number; skipWs: boolean }) {
    const rows = this.get().locator('.ant-table-tbody > tr.ant-table-row');
    const title = await getTextExcludeIconText(rows.nth(index).locator('.nc-base-title'));
    const role = await rows
      .nth(index)
      .locator('.ant-table-cell')
      .nth(1 + (skipWs ? 1 : 0))
      .innerText();
    const lastAccessed = await rows
      .nth(index)
      .locator('.ant-table-cell')
      .nth(2 + (skipWs ? 1 : 0))
      .innerText();
    return { title, lastAccessed, role };
  }

  // returns row locator based on base title
  //
  async getProjectRow({ title }: { title: string }) {
    const titles = [];
    const rows = this.get().locator('.ant-table-tbody > tr.ant-table-row');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      titles.push(await getTextExcludeIconText(rows.nth(i).locator('.nc-base-title')));
    }

    return rows.nth(titles.indexOf(title));
  }

  // returns number of base rows
  //
  async getProjectRowCount() {
    const rows = this.get().locator('.ant-table-tbody > tr.ant-table-row');
    return await rows.count();
  }

  async verifyDynamicElements({ title, lastAccessed, role }) {
    expect(await this.get().locator('.nc-workspace-title').innerText()).toBe(`ws_${title}`);
    expect(await this.getProjectRowData({ index: 0, skipWs: false })).toEqual({ title, lastAccessed, role });
  }

  // create base
  //
  async baseCreate({ title, type }: { title: string; type: 'db' | 'docs' }) {
    await this.newProjectButton.click();
    await this.rootPage.locator(`.nc-create-base-btn-${type}`).click();
    await this.rootPage.locator('.nc-metadb-base-name').fill(title);
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.nc-metadb-base-name').press('Enter'),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects`,
    });
  }

  // rename base
  //
  async baseRename({ title, newTitle }: { title: string; newTitle: string }) {
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(4).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Rename Base")').click();
    await row.locator('td.ant-table-cell').nth(0).locator('input').fill(newTitle);
    await this.waitForResponse({
      uiAction: () => row.locator('td.ant-table-cell').nth(0).locator('input').press('Enter'),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects/`,
    });
  }

  // move base
  //
  async baseMove({ title, newWorkspace }: { title: string; newWorkspace: string }) {
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(4).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Move Base")').click();

    await this.rootPage.locator('.ant-modal.active').locator('input').click();
    await this.rootPage.locator('.ant-select-dropdown').locator(`.ant-select-item:has-text("${newWorkspace}")`).click();

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.ant-modal.active').locator('button:has-text("Move")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/workspaces/`,
    });
  }

  // delete base
  //
  async baseDelete({ title }: { title: string }) {
    await this.rootPage.waitForTimeout(1000);
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(3).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete")').click();
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.ant-modal-content').locator('button:has-text("Delete")').click(),
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects/`,
    });
  }

  async baseOpen(param: { title: any }) {
    const row = await this.getProjectRow({ title: param.title });

    // use index 1, as 0 contains icon to mark favourite
    await row.locator('td.ant-table-cell').nth(1).waitFor({ state: 'visible' });
    await row.locator('td.ant-table-cell').nth(1).click();
  }

  async baseAddToFavourites({ title }: { title: string }) {
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(0).locator('.nc-icon').click({ force: true });
  }

  async getMoreActionsSubMenuDetails() {
    await this.moreActions.click();
    const menuItems = await this.rootPage.locator('.ant-dropdown-menu-item');
    const count = await menuItems.count();
    const menuItemsText = [];
    for (let i = 0; i < count; i++) {
      menuItemsText.push(await menuItems.nth(i).innerText());
    }
    return menuItemsText;
  }

  async deleteWorkspace({ title }: { title: string }) {
    await this.get().locator('.ant-checkbox-input').click();
    await this.get().locator('.ant-btn-danger:visible').waitFor();
    await this.get().locator('.ant-btn-danger:visible').click();
  }
}
