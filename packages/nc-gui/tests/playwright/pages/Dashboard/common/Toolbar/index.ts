import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarFieldsPage } from './Fields';
import { ToolbarSortPage } from './Sort';
import { ToolbarFilterPage } from './Filter';
import { ToolbarShareViewPage } from './ShareView';
import { ToolbarViewMenuPage } from './ViewMenu';
import * as fs from 'fs';
import { GridPage } from '../../Grid';
import { ToolbarActionsPage } from './Actions';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';
import { ToolbarStackbyPage } from './StackBy';
import { ToolbarAddEditStackPage } from './AddEditKanbanStack';

export class ToolbarPage extends BasePage {
  readonly parent: GridPage | GalleryPage | FormPage | KanbanPage;
  readonly fields: ToolbarFieldsPage;
  readonly sort: ToolbarSortPage;
  readonly filter: ToolbarFilterPage;
  readonly shareView: ToolbarShareViewPage;
  readonly viewsMenu: ToolbarViewMenuPage;
  readonly actions: ToolbarActionsPage;
  readonly stackBy: ToolbarStackbyPage;
  readonly addEditStack: ToolbarAddEditStackPage;

  constructor(parent: GridPage | GalleryPage | FormPage | KanbanPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.fields = new ToolbarFieldsPage(this);
    this.sort = new ToolbarSortPage(this);
    this.filter = new ToolbarFilterPage(this);
    this.shareView = new ToolbarShareViewPage(this);
    this.viewsMenu = new ToolbarViewMenuPage(this);
    this.actions = new ToolbarActionsPage(this);
    this.stackBy = new ToolbarStackbyPage(this);
    this.addEditStack = new ToolbarAddEditStackPage(this);
  }

  get() {
    return this.rootPage.locator(`.nc-table-toolbar`);
  }

  async clickActions() {
    const menuOpen = await this.actions.get().isVisible();

    await this.get().locator(`button.nc-actions-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.fields.get().waitFor({ state: 'hidden' });
  }

  async clickFields() {
    const menuOpen = await this.fields.get().isVisible();

    await this.get().locator(`button.nc-fields-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.fields.get().waitFor({ state: 'hidden' });
  }

  async clickSort() {
    const menuOpen = await this.sort.get().isVisible();

    await this.get().locator(`button.nc-sort-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.sort.get().waitFor({ state: 'hidden' });
  }

  async clickFilter() {
    const menuOpen = await this.filter.get().isVisible();

    await this.get().locator(`button.nc-filter-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.filter.get().waitFor({ state: 'hidden' });
  }

  async clickShareView() {
    const menuOpen = await this.shareView.get().isVisible();
    await this.get().locator(`button.nc-btn-share-view `).click();

    // Wait for the menu to close
    if (menuOpen) await this.shareView.get().waitFor({ state: 'hidden' });
  }

  async clickStackByField() {
    await this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn`).click();
  }

  async clickAddNewRow() {
    await this.get().locator(`.nc-toolbar-btn.nc-add-new-row-btn`).click();
  }

  async clickDownload(type: string, verificationFile = 'expectedData.txt') {
    await this.get().locator(`.nc-toolbar-btn.nc-actions-menu-btn`).click();

    const [download] = await Promise.all([
      // Start waiting for the download
      this.rootPage.waitForEvent('download'),
      // Perform the action that initiates download
      this.rootPage
        .locator(`.nc-dropdown-actions-menu`)
        .locator(`li.ant-dropdown-menu-item:has-text("${type}")`)
        .click(),
    ]);

    // Save downloaded file somewhere
    await download.saveAs('./output/at.txt');

    // verify downloaded content against expected content
    const expectedData = fs.readFileSync(`./fixtures/${verificationFile}`, 'utf8');
    const file = fs.readFileSync('./output/at.txt', 'utf8');
    await expect(file).toEqual(expectedData);
  }

  async verifyStackByButton({ title }: { title: string }) {
    await this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn`).waitFor({ state: 'visible' });
    await expect(
      await this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn:has-text("${title}")`)
    ).toBeVisible();
  }

  async verifyDownloadDisabled() {
    await this.get().locator(`.nc-toolbar-btn.nc-actions-menu-btn`).waitFor({ state: 'hidden' });
  }

  async clickAddEditStack() {
    await this.get().locator(`.nc-kanban-add-edit-stack-menu-btn`).click();
  }

  async validateViewsMenu(param: { role: string; mode?: string }) {
    let menuItems = {
      creator: ['Download', 'Upload', 'Shared View List', 'Webhooks', 'Get API Snippet', 'ERD View'],
      editor: ['Download', 'Upload', 'Get API Snippet', 'ERD View'],
      commenter: ['Download as CSV', 'Download as XLSX'],
      viewer: ['Download as CSV', 'Download as XLSX'],
    };

    if (param.mode === 'shareBase') {
      menuItems = {
        creator: [],
        editor: ['Download', 'Upload', 'ERD View'],
        commenter: [],
        viewer: ['Download as CSV', 'Download as XLSX'],
      };
    }

    const vMenu = await this.rootPage.locator('.nc-dropdown-actions-menu:visible');

    for (const item of menuItems[param.role]) {
      await expect(vMenu).toContainText(item);
    }
  }

  async validateRoleAccess(param: { role: string; mode?: string }) {
    await this.clickActions();
    await this.validateViewsMenu({
      role: param.role,
      mode: param.mode,
    });

    const menuItems = {
      creator: ['Fields', 'Filter', 'Sort', 'Share View'],
      editor: ['Fields', 'Filter', 'Sort'],
      commenter: ['Fields', 'Filter', 'Sort', 'Download'],
      viewer: ['Fields', 'Filter', 'Sort', 'Download'],
    };

    for (const item of menuItems[param.role]) {
      await expect(this.get()).toContainText(item);
    }

    await expect(this.get().locator('.nc-add-new-row-btn')).toHaveCount(
      param.role === 'creator' || param.role === 'editor' ? 1 : 0
    );
  }
}
