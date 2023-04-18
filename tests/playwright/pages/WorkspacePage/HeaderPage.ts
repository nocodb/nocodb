import BasePage from '../Base';
import { WorkspacePage } from './';

/*
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
 */

export class HeaderPage extends BasePage {
  readonly workspace: WorkspacePage;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
  }

  get() {
    return this.workspace.get().locator('.nc-header-content');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  // Menu : Workspaces, Explore, Help, Community
  async openMenu(param: { title: string }) {
    await this.get().locator(`[data-testid="nc-dash-nav-${param.title.toLowerCase()}"]`);
  }
}
