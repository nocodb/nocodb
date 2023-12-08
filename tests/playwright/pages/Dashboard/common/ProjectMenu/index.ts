import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';

export class ProjectMenuObject extends BasePage {
  constructor(parent: GridPage | GalleryPage | KanbanPage | FormPage) {
    super(parent.rootPage);
  }

  get() {
    return this.rootPage.locator(`[data-testid="nc-fields-menu"]`);
  }

  async toggle() {
    await this.rootPage.locator('[data-testid="nc-base-menu"]').click();
  }

  async click({ menu, subMenu }: { menu: string; subMenu: string }) {
    const pMenu = this.rootPage.locator(`.nc-dropdown-base-menu:visible`);
    await pMenu.locator(`div.nc-base-menu-item:has-text("${menu}"):visible`).click();
    await this.rootPage.waitForTimeout(2000);

    if (subMenu) {
      await this.rootPage.locator(`div.nc-base-menu-item:has-text("${subMenu}"):visible`).click();
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
