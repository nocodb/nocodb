import BasePage from '../Base';
import { WorkspacePage } from './';
import { expect } from '@playwright/test';
import { Locator } from 'playwright';
import { getIconText, getTextExcludeIconText } from '../../tests/utils/general';

/*
  nc-workspace-container
    nc-workspace-avatar
    nc-workspace-title
    button:has-text("New Project")
      |> .ant-dropdown-menu-vertical
          |> .ant-dropdown-menu-item : Database           nc-create-project-btn-db
              nc-shortcut-label-wrapper.nc-shortcut-label
          |> .ant-dropdown-menu-item : Documentation      nc-create-project-btn-docs
              nc-shortcut-label-wrapper.nc-shortcut-label

    ant-tabs-nav-list
      ant-tabs-tab : All Projects
      ant-tabs-tab : Collaborators

    thead.ant-table-thead
      tr.ant-table-row
        td.ant-table-cell (nc-project-title)
          material-symbols-outlined : database
          span : project title
          nc-icon : favourites icon
        td.ant-table-cell (color)
        td.ant-table-cell (last accessed)
        td.ant-table-cell (my role)
        td.ant-table-cell (actions)
          nc-icon (...) : click
            |> .ant-dropdown-menu-item : Rename Project
            |> .ant-dropdown-menu-item : Move Project
            |> .ant-dropdown-menu-item : Delete Project
 */

export class ContainerPage extends BasePage {
  readonly workspace: WorkspacePage;
  readonly newProjectButton: Locator;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
    this.newProjectButton = this.get().locator('button:has-text("New Project")');
  }

  get() {
    return this.workspace.get().locator('.nc-workspace-container');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  async verifyStaticElements() {
    const tableHeaderCells = await this.get().locator('.ant-table-thead > tr > th.ant-table-cell');
    expect(await tableHeaderCells.count()).toBe(6);
    expect(await tableHeaderCells.nth(0).innerText()).toBe('Project Name');
    expect(await tableHeaderCells.nth(1).innerText()).toBe('Color');
    expect(await tableHeaderCells.nth(2).innerText()).toBe('Last Accessed');
    expect(await tableHeaderCells.nth(3).innerText()).toBe('My Role');
    expect(await tableHeaderCells.nth(4).innerText()).toBe('Actions');

    // Fix me! This is not working
    // const tabs = await this.get().locator('.ant-tabs-tab-btn');
    // expect(await tabs.count()).toBe(2);
    // expect(await tabs.nth(0).innerText()).toBe('All Projects');
    // expect(await tabs.nth(1).innerText()).toBe('Collaborators');
    //
    // await this.newProjectButton.waitFor({ state: 'visible' });
  }

  async getProjectRowData(index: number) {
    const rows = await this.get().locator('.ant-table-tbody > tr.ant-table-row');
    const title = await getTextExcludeIconText(rows.nth(index).locator('.nc-project-title'));
    const lastAccessed = await rows.nth(index).locator('.ant-table-cell').nth(2).innerText();
    const role = await rows.nth(index).locator('.ant-table-cell').nth(3).innerText();
    const icon = await getIconText(rows.nth(index).locator('.nc-project-title'));
    return { icon, title, lastAccessed, role };
  }

  // returns row locator based on project title
  //
  async getProjectRow({ title }: { title: string }) {
    const titles = [];
    const rows = await this.get().locator('.ant-table-tbody > tr.ant-table-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      titles.push(await getTextExcludeIconText(rows.nth(i).locator('.nc-project-title')));
    }
    return rows.nth(titles.indexOf(title));
  }

  // returns number of project rows
  //
  async getProjectRowCount() {
    const rows = await this.get().locator('.ant-table-tbody > tr.ant-table-row');
    return await rows.count();
  }

  async verifyDynamicElements({ icon, title, lastAccessed, role }) {
    expect(await this.get().locator('.nc-workspace-title').innerText()).toBe(`ws_${title}`);
    expect(await this.getProjectRowData(0)).toEqual({ icon, title, lastAccessed, role });
  }

  // create project
  //
  async projectCreate({ title, type }: { title: string; type: 'db' | 'docs' }) {
    await this.newProjectButton.click();
    await this.rootPage.locator(`.nc-create-project-btn-${type}`).click();
    await this.rootPage.locator('.nc-metadb-project-name').fill(title);
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.nc-metadb-project-name').press('Enter'),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/db/meta/projects`,
    });
  }

  // rename project
  //
  async projectRename({ title, newTitle }: { title: string; newTitle: string }) {
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(4).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Rename Project")').click();
    await row.locator('td.ant-table-cell').nth(0).locator('input').fill(newTitle);
    await this.waitForResponse({
      uiAction: () => row.locator('td.ant-table-cell').nth(0).locator('input').press('Enter'),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `api/v1/db/meta/projects/`,
    });
  }

  // move project
  //
  async projectMove({ title, newWorkspace }: { title: string; newWorkspace: string }) {
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(4).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Move Project")').click();

    await this.rootPage.locator('.ant-modal.active').locator('input').click();
    await this.rootPage.locator('.ant-select-dropdown').locator(`.ant-select-item:has-text("${newWorkspace}")`).click();

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.ant-modal.active').locator('button:has-text("Move")').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/workspaces/`,
    });
  }

  // delete project
  //
  async projectDelete({ title }: { title: string }) {
    await this.rootPage.waitForTimeout(1000);
    const row = await this.getProjectRow({ title });
    await row.locator('td.ant-table-cell').nth(4).locator('.nc-icon').click();
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete Project")').click();
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.ant-modal-confirm').locator('button:has-text("Yes")').click(),
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: `api/v1/db/meta/projects/`,
    });
  }

  async projectOpen(param: { title: any }) {
    const row = await this.getProjectRow({ title: param.title });
    await row.locator('td.ant-table-cell').nth(0).click();
  }
}
