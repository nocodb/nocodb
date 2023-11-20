import BasePage from '../../../Base';
import { SidebarPage } from '..';

export class SidebarUserMenuObject extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(parent: SidebarPage) {
    super(parent.rootPage);

    this.sidebar = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-sidebar-userinfo');
  }

  async click() {
    await this.rootPage.getByTestId('nc-sidebar-userinfo').click();
  }

  async clickLogout() {
    await this.rootPage.getByTestId('nc-sidebar-user-logout').click();
  }
}
