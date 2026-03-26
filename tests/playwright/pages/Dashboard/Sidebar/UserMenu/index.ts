import BasePage from '../../../Base';
import { SidebarPage } from '..';

export class SidebarUserMenuObject extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(parent: SidebarPage) {
    super(parent.rootPage);

    this.sidebar = parent;
  }

  get() {
    // Match both MiniSidebar userinfo and HomeSidebar userinfo
    return this.rootPage.getByTestId('nc-sidebar-userinfo').first();
  }

  async click() {
    await this.get().click();
  }

  async clickLogout() {
    await this.rootPage.getByTestId('nc-sidebar-user-logout').click();
  }
}
