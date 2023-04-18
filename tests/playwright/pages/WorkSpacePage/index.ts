import { expect, Locator, Page } from '@playwright/test';
import BasePage from './Base';

export class WorkspacePage extends BasePage {
  readonly wsHeader: WsHeaderPage;
  readonly wsLeftSideBar: WsLeftSideBarPage;
  readonly wsContainer: WsContainerPage;

  constructor(rootPage: Page) {
    super(rootPage);
  }

  /*
    Workspace page
    --------------
    nc-app
      nc-header-content
          [data-testid="nc-dash-nav-workspaces"]
          [data-testid="nc-dash-nav-explore"]
          [data-testid="nc-dash-nav-help"]
          [data-testid="nc-dash-nav-community"]
        nc-quick-action-wrapper
          input["placeholder="Quick Actions"]
        nc-icon : notifications
        [data-testid="nc-ws-account-menu-dropdown"]
          |> .ant-dropdown-menu-vertical
            |> [data-testid="nc-menu-accounts__user-settings"]
            |> [data-testid="nc-menu-accounts__sign-out"]

      nc-root

        nc-left-sidebar
          nc-workspace-group
            > Recent
            > Shared with me
            > Favourites

          All Workspaces
            nc-icon (+)

          ul.nc-workspace-list
            nc-workspace-title
              span:nth-child(0) : workspace title
              span:nth-child(1) : workspace owner : displayed on hover
            nc-workspace-drag-icon
            nc-icon.nc-workspace-menu (...) : click
              |> .ant-dropdown-menu-vertical
                  |> .ant-dropdown-menu-item : Rename Workspace
                  |> .ant-dropdown-menu-item : Delete Workspace

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


    Workspace create modal
    ----------------------
    nc-modal-workspace-create
      input[data-testid="create-workspace-ws-name"]
      input[data-testid="create-workspace-ws-description"]
        ant-modal-close-x
        button:has-text("Submit")
        button:has-text("Cancel")
  */

  get() {
    return this.rootPage.locator('nc-app');
  }

  async logout() {
    await this.get().getByTestId('nc-ws-account-menu-dropdown').click();
    await this.get().getByTestId('nc-logout-btn').click();
  }

  getWorkspaceContainer() {
    return this.get().locator('.nc-workspace-container');
  }

  getWorkspaceList() {
    return this.getWorkspaceContainer().locator('.nc-workspace-list');
  }

  async selectProject({ title }: { title: string }) {
    await this.get()
      .locator('.nc-project-title', {
        hasText: title,
      })
      .click();

    // TODO: Remove this timeout
    await this.rootPage.waitForTimeout(1500);
  }

  async verifyWorkspaceCount({ count }: { count: number }) {
    await expect(this.getWorkspaceList().locator('.nc-workspace-list-item')).toHaveCount(count);
  }

  // TODO: this function can be moved to tests/playwright/pages/Dashboard/index.ts
  async checkVisibleAndClick(title: string) {
    const loc: Locator = this.rootPage.getByTestId(title);
    await expect(loc).toBeVisible();
    await loc.click();
    await this.rootPage.waitForLoadState('networkidle');
  }
}
