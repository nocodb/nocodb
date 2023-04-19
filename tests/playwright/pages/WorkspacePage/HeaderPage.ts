import BasePage from '../Base';
import { WorkspacePage } from './';

/*
  nc-header-content
      [data-testid="nc-dash-nav-workspaces"]
      [data-testid="nc-dash-nav-explore"]
      [data-testid="nc-dash-nav-help"]
      [data-testid="nc-dash-nav-community"]
  data-testid="nc-quick-action-wrapper"
  input["placeholder="Quick Actions"]
  [data-testid="nc-notification-bell-icon"]
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

  async verifyStaticElements() {
    // logo on the left
    await this.get().locator('img[src="/_nuxt/assets/img/brand/nocodb-full-color.png"]').waitFor({ state: 'visible' });

    // menu items on the center
    await this.get().locator('[data-testid="nc-dash-nav-workspaces"]').waitFor({ state: 'visible' });
    await this.get().locator('[data-testid="nc-dash-nav-explore"]').waitFor({ state: 'visible' });
    await this.get().locator('[data-testid="nc-dash-nav-help"]').waitFor({ state: 'visible' });
    await this.get().locator('[data-testid="nc-dash-nav-community"]').waitFor({ state: 'visible' });

    // quick action, notifications & account menu on the right
    await this.get().locator('[data-testid="nc-quick-action-wrapper"]').waitFor({ state: 'visible' });
    await this.get().locator('input[placeholder="Quick Actions"]').waitFor({ state: 'visible' });
    await this.get().locator('[data-testid="nc-notification-bell-icon"]').waitFor({ state: 'visible' });
    await this.get().locator('[data-testid="nc-ws-account-menu-dropdown"]').waitFor({ state: 'visible' });
  }

  // Custom routines
  //

  // Menu : Workspaces, Explore, Help, Community
  async openMenu(param: { title: string }) {
    await this.get().locator(`[data-testid="nc-dash-nav-${param.title.toLowerCase()}"]`);
  }
}
