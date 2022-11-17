import { expect, Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { ToolbarPage } from './index';
// @ts-ignore
import fs from 'fs';

export class ToolbarViewMenuPage extends BasePage {
  readonly toolbar: ToolbarPage;
  readonly viewsMenuBtn: Locator;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
    this.viewsMenuBtn = this.toolbar.get().locator(`.nc-actions-menu-btn`);
  }

  get() {
    return this.rootPage.locator(`.ant-dropdown.nc-dropdown-actions-menu`);
  }

  getLockTypeSubMenu() {
    return this.rootPage.locator(`[id="sub_menu_1_$$_lock-type-popup"]`);
  }

  async verifyDownloadAsCSV({
    downloadLocator,
    expectedDataFile,
  }: {
    downloadLocator: Locator;
    expectedDataFile: string;
  }) {
    const [download] = await Promise.all([
      // Start waiting for the download
      this.rootPage.waitForEvent('download'),
      // Perform the action that initiates download
      downloadLocator.click(),
    ]);

    // Save downloaded file somewhere
    await download.saveAs('./output/at.txt');

    // verify downloaded content against expected content
    const expectedData = fs.readFileSync(expectedDataFile, 'utf8');
    const file = fs.readFileSync('./output/at.txt', 'utf8');
    await expect(file).toEqual(expectedData);
  }

  // menu items
  //    Collaborative View
  //    Download
  //    Upload
  //    Shared View List
  //    Webhooks
  //    Get API Snippet
  //    ERD View

  // todo: Move verification out of the click method
  async click({ menu, subMenu, verificationInfo }: { menu: string; subMenu?: string; verificationInfo?: any }) {
    await this.viewsMenuBtn.click();
    await this.get().locator(`.ant-dropdown-menu-title-content:has-text("${menu}")`).first().click();
    if (subMenu) {
      // for CSV download, pass locator instead of clicking it here
      if (subMenu === 'Download as CSV') {
        await this.verifyDownloadAsCSV({
          downloadLocator: await this.rootPage
            .locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`)
            .last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else {
        await this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last().click();
      }

      switch (subMenu) {
        case 'Download as CSV':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Locked View':
          await this.verifyToast({
            message: 'Successfully Switched to locked view',
          });
          break;
        case 'Collaborative View':
          await this.verifyToast({
            message: 'Successfully Switched to collaborative view',
          });
          break;
        default:
          break;
      }
    }
    await this.toolbar.parent.waitLoading();
  }

  async verifyLockMode() {
    await expect(await this.toolbar.get().locator(`.nc-fields-menu-btn.nc-toolbar-btn`)).toBeDisabled();
    await expect(await this.toolbar.get().locator(`.nc-filter-menu-btn.nc-toolbar-btn`)).toBeDisabled();
    await expect(await this.toolbar.get().locator(`.nc-sort-menu-btn.nc-toolbar-btn`)).toBeDisabled();
    await expect(
      await this.toolbar.get().locator(`.nc-add-new-row-btn.nc-toolbar-btn > .nc-icon.disabled`)
    ).toBeVisible();

    await (this.toolbar.parent as GridPage).verifyEditDisabled({
      columnHeader: 'Country',
    });
  }

  async verifyCollaborativeMode() {
    await expect(await this.toolbar.get().locator(`.nc-fields-menu-btn.nc-toolbar-btn`)).toBeEnabled();
    await expect(await this.toolbar.get().locator(`.nc-filter-menu-btn.nc-toolbar-btn`)).toBeEnabled();
    await expect(await this.toolbar.get().locator(`.nc-sort-menu-btn.nc-toolbar-btn`)).toBeEnabled();
    await expect(await this.toolbar.get().locator(`.nc-add-new-row-btn.nc-toolbar-btn > .nc-icon`)).toBeVisible();

    await (this.toolbar.parent as GridPage).verifyEditEnabled({
      columnHeader: 'Country',
    });
  }
}
