import BasePage from '../Base';
import { WorkspacePage } from './';

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

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
  }

  get() {
    return this.workspace.get().locator('.nc-workspace-container');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }
}
