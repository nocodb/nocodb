import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';

export class WorkspaceMenuObject extends BasePage {
  constructor(parent: GridPage | GalleryPage | KanbanPage | FormPage) {
    super(parent.rootPage);
  }

  get() {
    return this.rootPage.locator(`.nc-dropdown-workspace-menu`);
  }

  async toggle() {
    await this.rootPage.locator('[data-testid="nc-workspace-menu"]').click();
  }

  async switchWorkspace({ workspaceTitle }: { workspaceTitle: string }) {
    await this.toggle();
    await this.rootPage.waitForTimeout(2500);
    await this.rootPage.locator('.ant-dropdown-menu').getByTestId('nc-workspace-list').getByText(workspaceTitle).click({
      force: true,
    });
    await this.rootPage.keyboard.press('Escape');
    await this.rootPage.waitForTimeout(4000);
  }

  async click({ menu, subMenu }: { menu: string; subMenu: string }) {
    const pMenu = this.rootPage.locator(`.nc-dropdown-workspace-menu:visible`);
    await pMenu.locator(`div.nc-workspace-menu-item:has-text("${menu}"):visible`).click();
    await this.rootPage.waitForTimeout(2000);

    if (subMenu) {
      await this.rootPage.locator(`div.nc-workspace-menu-item:has-text("${subMenu}"):visible`).click();
      await this.rootPage.waitForTimeout(1000);
    }
  }

  async clickPreview(role: string) {
    await this.click({
      menu: 'Preview as',
      subMenu: role,
    });
    await this.rootPage.waitForTimeout(2500);
  }
}
