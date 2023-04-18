import BasePage from '../Base';
import { WorkspacePage } from './';

/*
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
 */

export class LeftSideBarPage extends BasePage {
  readonly workspace: WorkspacePage;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
  }

  get() {
    return this.workspace.get().locator('.nc-left-sidebar');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  async getWsCount() {
    return (await this.get().locator('li.ant-menu-item')).count();
  }
}
