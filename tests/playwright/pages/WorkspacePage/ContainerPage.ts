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

  async getProjectRow(index: number) {
    const rows = await this.get().locator('.ant-table-tbody > tr.ant-table-row');
    const title = await getTextExcludeIconText(rows.nth(index).locator('.nc-project-title'));
    const lastAccessed = await rows.nth(index).locator('.ant-table-cell').nth(2).innerText();
    const role = await rows.nth(index).locator('.ant-table-cell').nth(3).innerText();
    const icon = await getIconText(rows.nth(index).locator('.nc-project-title'));
    return { icon, title, lastAccessed, role };
  }

  async verifyDynamicElements({ icon, title, lastAccessed, role }) {
    expect(await this.get().locator('.nc-workspace-title').innerText()).toBe(`ws_${title}`);
    expect(await this.getProjectRow(0)).toEqual({ icon, title, lastAccessed, role });
  }

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
}
