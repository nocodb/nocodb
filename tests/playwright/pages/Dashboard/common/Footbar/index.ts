import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { FormPage } from '../../Form';
import { KanbanPage } from '../../Kanban';
import { MapPage } from '../../Map';
import { Locator } from '@playwright/test';

export class FootbarPage extends BasePage {
  readonly parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage;
  readonly leftSidebarToggle: Locator;
  readonly rightSidebarToggle: Locator;

  constructor(parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.leftSidebarToggle = this.get().locator(`div.nc-sidebar-left-toggle-icon`);
    this.rightSidebarToggle = this.get().locator(`div.nc-sidebar-right-toggle-icon`);
  }

  get() {
    return this.rootPage.locator(`div.nc-pagination-wrapper`);
  }

  async clickAddRecord() {
    await this.get().locator(`button.ant-btn`).nth(0).click();
  }

  async clickAddRecordFromForm() {
    await this.get().locator(`button.ant-btn`).nth(1).click();
    await this.rootPage.locator('.ant-dropdown-content').waitFor({ state: 'visible' });
    await this.rootPage.locator('.ant-dropdown-content').locator('.nc-new-record-with-form').click();
  }
}
